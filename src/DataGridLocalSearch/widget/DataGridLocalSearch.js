define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",

    "dojo/query",
    "dojo/aspect",
    "dijit/registry",
    "dojo/text!DataGridLocalSearch/widget/template/DataGridLocalSearch.html"

], function(declare, _WidgetBase, _TemplatedMixin, dojoQuery, dojoAspect, registry, widgetTemplate) {
    "use strict";

    return declare("DataGridLocalSearch.widget.DataGridLocalSearch", [_WidgetBase, _TemplatedMixin], {
        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        // Internal variables.
        _handles: null,
        _contextObj: null,
        _MS_IN_DAY: 24 * 60 * 60 * 1000,
        _dataType: '',
        _refreshing: false,

        constructor: function() {
            this._handles = [];
        },

        postCreate: function() {
            this._attachEventsToSearchBox();
        },

        update: function(obj, callback) {

            this._contextObj = obj;
            
            if(callback) callback();
        },

        uninitialize: function() {
        },
        _findGrid: function () {
			var nodeList = dojoQuery(".mx-name-" + this.targetGridName);

			var gridNodes = nodeList; // ? nodeList[nodeList.length-1]: null;
			if (gridNodes) {
                var grid =  gridNodes[0];
                if (grid) {
                    return registry.byNode(grid);
                }
            }
            console.error("Could not find the grid to search on with name " + this.targetGridName + ".");
            return null;
		},

        _attachEventsToSearchBox: function() {
            var searchNode = this.searchNode;
            this.connect(searchNode, "keyup", "_doSearch");
            this.connect(searchNode, "click", "_ignore");
            this.connect(searchNode, "keypress", "_ignore");
            this.connect(searchNode, "keydown", "_ignore");
            this.connect(searchNode, "keypress", "_escapeReset");

            var searchIcon = this.searchIcon;
            this.connect(searchIcon, "click", "_ignore");
        },
        _doSearch: function() {
            clearTimeout(this._searchTimeout);


            this._searchTimeout = setTimeout(function() {
                this._refreshing = true;
                this._grid = this._findGrid();

                if (this._grid.config.datasource.type !==  "entityPath" && this._grid.config.datasource.type !== "microflow" ) {
                    console.error("Grid must be sourced via microflow or association to perform a local search.");
                }            
                var grid = this._grid,
                    datasource = grid._dataSource;

                if (!datasource._holdObjs) {
                    datasource._holdObjs = datasource._allObjects || datasource._allObjs;
                }

                if(grid) {
                    this._resetHandles(grid);
                }

                this._buildMicroflowFilter();
                datasource._allObjects = datasource._holdObjs.filter(datasource._filter);
                datasource._updateClientPaging(datasource._allObjects);
                grid.fillGrid()
                this._refreshing = false;
            }.bind(this), 250);
        },
        _buildMicroflowFilter: function() {
            var datasource = this._grid._dataSource;
            var curVal = this.searchNode.value;
            if (!curVal) {
                curVal = "";
            }
            var keyword = curVal.toLowerCase();
            var targetAttributes = [];
            if (this.attrsToSearch) {
                targetAttributes = this.attrsToSearch.map(item => item.attribute);
            }

            datasource._filter = function(rowObj) {
                //run a contains search against the entire object
                var attrs = [];
                if (targetAttributes.length > 0) {
                    attrs = targetAttributes;
                } else {
                    attrs = rowObj.getPrimitives();

                }

                var vals = attrs.map(attr => {
                    if (rowObj.metaData.isDate(attr)) {
                        return mx.parser.formatAttribute(rowObj, attr, { datePattern: mx.session.sessionData.locale.patterns.datetime })
                    /*} else if (rowObj.metaData.isEnum(attr)) {
                        var enumMap = rowObj.metaData.getEnumMap(attr); //used in 6.10.3
                        return*/ 
                    } else {
                        return mx.parser.formatAttribute(rowObj, attr);
                    } 
                });
                var searchInString = vals.join("|").toLowerCase();
                console.debug("Searching for: " + keyword + "\nin the string: " + searchInString);
                return searchInString.includes(keyword);
            };
        },        
        _resetHandles: function(grid) {
            //if the grid refreshes (like in a tab set to reload), re-apply the search
            //this._grid.registerToPluginEvent("triggerOnRefresh", this._doSearch.bind(this), true)
            if (this.applyHandle) {
                this.applyHandle.remove();
            }
            this.applyHandle = dojoAspect.after(grid, "applyContext", function(deferred, args) {
                this._doSearch();
                return deferred;
            }.bind(this));
            if (this.refreshHandle) {
                this.refreshHandle.remove();
            }
            this.refreshHandle = dojoAspect.around(grid, "refreshGrid", function(deferred, args) {
                var self = this;
                return function() {
                    if (!self._refreshing) {
                        self._doSearch();
                    } else {
                        deferred();
                    }
                }
            }.bind(this));
        },
        _ignore: function(e) {
            e.stopPropagation();
        },
        _escapeReset: function(e) {
            if (e.keyCode == 27) { // escape key maps to keycode `27`
                this.searchNode.value = "";
                this._doSearch();
            }
        }
    });
});

require(["DataGridLocalSearch/widget/DataGridLocalSearch"]);
