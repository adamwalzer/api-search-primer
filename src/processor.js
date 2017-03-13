var api = require('./api.js');
var search = require('./search.js');
var _ = require('lodash');
var util = require('util');
var EventEmitter = require('events');
var logger = require('./logger.js').logger;

function ProcessorEmitter() {
    EventEmitter.call(this);
}

util.inherits(ProcessorEmitter, EventEmitter);

/**
 * @typedef {Object} SwaggerType
 * @property {Object.<SwaggerDef>} definitions
 */

/**
 * @typedef {Object} SwaggerDef
 * @property {String} type
 * @property {String} description
 * @property {String[]} required
 * @property {Object.<SwaggerProp[]>} properties
 * @property {Array.<SwaggerRef>} allOf
 */

/**
 * @typedef {Object} SwaggerRef
 * @property {String} $ref
 */

/**
 * @typedef {Object} SwaggerProp
 * @property {String} description
 * @property {String} type
 * @property {String} format
 * @property {String[]} enum
 */

/**
 * @typedef {Object} SwaggerParams
 * @property {String} name
 * @property {String} in
 * @property {Boolean} required
 * @property {String} description
 * @property {String} type
 * @property {String} format
 * @property {Number} maximum
 * @property {Number} minimum
 */

/**
 *
 * @param {Object.<api>} api
 * @param {object.<search>} search
 * @param {object.<logger>} logger
 */
module.exports = function Processor(api, search, logger) {
    /**
     * Finds all the models that have x-search-doc-type in the spec
     *
     * @param {Function.<getDefProperties>} getParentProps
     * @param {Object.<SwaggerType>} swaggerJson - the swagger doc
     *
     * @return {Array} all the models that are marked as searchable
     */
    var getSearchableModels = _.memoize((getParentProps, swaggerJson) => {
        return _.transform(
            _.pickBy(swaggerJson.definitions, _.partial(_.has, _, 'x-search-doc-type')),
            (result, value, key) => {
                _.set(value, 'properties', getParentProps(key));
                _.set(result, _.toLower(key), value);
            }
        );
    }, (getParentProps, swaggerJson ) => {
        return JSON.stringify(swaggerJson);
    });

    /**
     * Finds all the properties of a definition from swagger
     *
     * @type {Function}
     * @return {Object.<SwaggerProp[]>}
     */
    var getDefProperties = _.memoize((swaggerJson, def) => {
        // This changes a JSON ref into something we can use in lodash to get
        //    the spec
        def = _.replace(def, '#/definitions/', '');

        var spec = _.get(swaggerJson, 'definitions.' + def, {});
        return _.reduce(_.get(spec, 'allOf'), (properties, ref) => {
            _.merge(properties, getDefProperties(swaggerJson, _.get(ref, '$ref')));
            return properties;
        }, _.get(swaggerJson, 'definitions.' + def + '.properties', {}));
    }, (swaggerJson, parent) => {
        return parent;
    });

    /**
     * Finds all the search paths for models
     *
     * @param {Object.<SwaggerType>} swaggerJson - the swagger doc
     *
     * @return {Array} all the models that are marked as searchable
     */
    var getSearchablePaths = _.memoize(swaggerJson => {
        return _.reduce(swaggerJson.paths, (paths, pathSpec, pathKey) => {
            if (!_.has(pathSpec, 'get.x-prime-for')) {
                return paths;
            }

            var primes = _.toLower(_.get(pathSpec, 'get.x-prime-for'));
            return _.defaults(_.zipObject([primes], [pathKey]), paths);
        }, []);
    });

    /**
     * Compares the mappings to what is already in elastic and updates them if need be
     *
     * @param {Object.<search>} searchApi - elastic search api
     * @param {Object.<SwaggerDef>} searchable
     *
     * @todo suppot multi-field types
     */
    var updateElasticMapping = (searchApi, searchable) => {
        var promises = _.map(searchable, (spec, entity) => {
            return new Promise((resolve, reject) => {
                return searchApi.getMapping(entity)
                    .then(mapping => {
                        var specProps = _.get(spec, 'elasticMap');
                        if (!_.isEqual(specProps, mapping)) {
                            logger.log('info', 'Updating mapping for', entity);
                            return search.createMapping(entity, specProps)
                                .then(result => {
                                    console.log(result);
                                });
                        }
                    })
                    .then(resolve);
            });
        });

        return Promise.all(promises).then(() => {return searchable;});
    };

    /**
     * Creates an elastic map based on swagger type
     *
     * @type {Function}
     * @param {String} type - the swagger type
     * @return {Object.<ElasticMapping>}
     * @todo suppot multi-field types
     */
    var swaggerTypeToElastic = _.memoize(type => {
        switch (type) {
            case 'uuid':
                return {
                    type: 'string',
                    index: 'no' // UUID's are not searchable
                };
                break;

            case 'int32':
                return {
                    type: 'integer',
                    doc_values: false,
                    ignore_malformed: true
                };
                break;

            case 'int64':
                return {
                    type: 'long',
                    doc_values: false,
                    ignore_malformed: true
                };
                break;

            case 'double':
                return {
                    type: 'double', // Swagger does not specify 32 or 64 float assume 64
                    doc_values: false,
                    ignore_malformed: true
                };
                break;

            case 'date':
            case 'date-time':
                return {
                    type: 'date',
                    format: 'strict_date_optional_time' // Standard ISO date with optional time: https://www.elastic.co/guide/en/elasticsearch/reference/2.3/mapping-date-format.html
                };
                break;

            case 'byte':
                return {
                    type: 'string',
                    index: 'not_analyzed',
                    include_in_all: false
                };
                break;

            case 'binary':
                return {
                    type: 'boolean',
                    index: 'no'
                };
                break;

            case 'password':
                return {
                    type: 'boolean',
                    index: 'no',
                    include_in_all: false
                };
                break;

            case 'string':
                return {type: 'string'};
                break;

            default:
                logger.info('warn', 'Property type', type, 'cannot be mapped to elastic');
                return {
                    type: 'string',
                    index: 'no',
                    include_in_all: false
                };
        }
    });

    /**
     * Creates an elastic mapping from swagger specification
     *
     * @param {Function.<swaggerTypeToElastic>} propMap
     * @param {Object.<SwaggerDef>} spec
     * @return {Object.<ElasticMapping[]>}
     */
    var swaggerToElasticMapping = (propMap, spec) => {
        return mapping = _.reduce(_.get(spec, 'properties', []), (mapping, prop, name) => {
            var type = _.get(prop, 'type', 'string');
            type = _.get(prop, 'format', type);

            _.set(mapping, name, propMap(type));
            return mapping;
        }, {});
    };

    return {
        index: (swaggerUrl) => {
            api.getUrl(swaggerUrl)
                .then(swaggerJson => {
                    logger.log('info', 'Swagger Downloaded');
                    // Get all the searchable models
                    var searchable = getSearchableModels(
                        _.partial(getDefProperties, swaggerJson),
                        swaggerJson
                    );

                    // Get the Entities that represent those models
                    var paths = getSearchablePaths(swaggerJson);

                    // Remove searchable entities with no matching path
                    var missing = _.difference(_.keys(searchable), _.keys(paths));
                    if (!_.isEmpty(missing)) {
                        logger.log('warn', 'Missing paths to prime:', missing);
                        searchable = _.omit(searchable, missing);
                    }

                    // Map the path to the model and flatten the properties
                    return _.reduce(searchable, (defs, value, key) => {
                        _.set(value, 'path', _.get(paths, key));

                        _.set(value, 'elasticMap', swaggerToElasticMapping(
                            swaggerTypeToElastic,
                            value
                        ));

                        _.set(defs, key, value);
                        return defs;
                    }, searchable);
                })
                // Check the index exists and create if need be
                .then(searchable => {
                    return new Promise((resolve, reject) => {
                        search.checkIndex()
                            .then(hasIndex => {
                                if (hasIndex) {
                                    logger.log('info', 'Index exists');
                                    return searchable;
                                }

                                logger.log('info', 'need to create index');
                                return search.createIndex().then(() => {
                                    return searchable
                                });
                            })
                            .then(resolve)
                            .catch(reject);
                    });
                })
                // TODO merge parent properties for each entity
                // Compare mappings and create if need be
                .then(_.partial(updateElasticMapping, search))
                .then(console.log);
        }
    };
};