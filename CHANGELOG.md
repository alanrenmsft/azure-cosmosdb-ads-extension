# Change Log
## [0.1.0] - 5/19/22
### Initial release

## [0.1.1] - 6/02/22
### Bug fixes
* Create collection or database updates the dashboard
* Upload sample data updates dashboard and connection tree
* Clicking on collection in dashboard opens mongoshell
* Allow multiple mongo shells open per account

## [0.1.2] - 7/18/22
### New changes
* Allow multiple mongoshell on same account or database
* Add Telemetry using ADS ai key
* Add ability to change throughput for CosmosDB collections by clicking on table in dashboard
* more error handling
* Add ability to change datababase scale settings
* Make delete database or collection consistent with portal experience: must type name to delete
### Bug fixes
* Restrict dashboard to COSMOSDB_MONGO provider

## [0.1.3] - 9/15/2022
### New changes
* Add a New Database and New Collection dialogs in order to allow user to input Cosmos DB-specific parameters such as Throughput, or Shard Key
* Breadcrumb in database dashboard
* Rename sample data collection from to "Customer Data". Properly create sharded collection
* For CosmosDB account, display throughput and shard key information in the dashboards
### Bug fixes
* Fix github ci (thanks JoeCalvert!)
* Fix bug: mistyping collection name when deleting collection fails silently
