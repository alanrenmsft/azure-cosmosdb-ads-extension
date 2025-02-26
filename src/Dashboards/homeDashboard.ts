/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from "azdata";
import { ICellActionEventArgs } from "azdata";
import * as vscode from "vscode";
import * as nls from "vscode-nls";
import {
  AppContext,
  changeMongoDbDatabaseThroughput,
  getAccountName,
  getAccountNameFromOptions,
  isAzureConnection,
  retrieveDatabaseAccountInfoFromArm,
  retrieveMongoDbDatabasesInfoFromArm,
  retrievePortalEndpoint,
  retrieveResourceId,
} from "../appContext";
import { COSMOSDB_DOC_URL, Telemetry } from "../constant";
import { IConnectionNodeInfo, IDatabaseDashboardInfo } from "../extension";
import { convertToConnectionOptions, ICosmosDbDatabaseInfo, IDatabaseInfo } from "../models";
import { buildHeroCard } from "./util";

const localize = nls.loadMessageBundle();

let refreshProperties: () => void;
let refreshDatabases: () => void;

const buildToolbar = (
  view: azdata.ModelView,
  context: vscode.ExtensionContext,
  appContext: AppContext
): azdata.ToolbarContainer => {
  const buttons: (azdata.ButtonProperties & { onDidClick: () => void })[] = [
    {
      label: localize("newDatabase", "New Database"),
      iconPath: {
        light: context.asAbsolutePath("resources/light/add-database.svg"),
        dark: context.asAbsolutePath("resources/dark/add-database-inverse.svg"),
      },
      onDidClick: () => {
        const param: IConnectionNodeInfo = {
          connectionId: view.connection.connectionId,
          ...convertToConnectionOptions(view.connection),
        };
        vscode.commands
          .executeCommand("cosmosdb-ads-extension.createMongoDatabase", undefined, param)
          .then(() => refreshDatabases && refreshDatabases());
        appContext.reporter?.sendActionEvent(
          Telemetry.sources.homeDashboard,
          Telemetry.actions.click,
          Telemetry.targets.homeDashboard.toolbarNewDatabase
        );
      },
    },
    {
      label: localize("openMongoShell", "Open Mongo Shell"),
      iconPath: {
        light: context.asAbsolutePath("resources/light/mongo-shell.svg"),
        dark: context.asAbsolutePath("resources/dark/mongo-shell-inverse.svg"),
      },
      onDidClick() {
        vscode.commands.executeCommand(
          "cosmosdb-ads-extension.openMongoShell",
          convertToConnectionOptions(view.connection)
        );
        appContext.reporter?.sendActionEvent(
          Telemetry.sources.homeDashboard,
          Telemetry.actions.click,
          Telemetry.targets.homeDashboard.toolbarOpenMongoShell
        );
      },
    },
    {
      label: localize("refresh", "Refresh"),
      iconPath: {
        light: context.asAbsolutePath("resources/light/refresh.svg"),
        dark: context.asAbsolutePath("resources/dark/refresh-inverse.svg"),
      },
      onDidClick() {
        refreshProperties && refreshProperties();
        refreshDatabases && refreshDatabases();
        appContext.reporter?.sendActionEvent(
          Telemetry.sources.homeDashboard,
          Telemetry.actions.click,
          Telemetry.targets.homeDashboard.toolbarRefresh
        );
      },
    },
    {
      label: localize("learnMore", "Learn more"),
      iconPath: {
        light: context.asAbsolutePath("resources/light/learn-more.svg"),
        dark: context.asAbsolutePath("resources/dark/learn-more-inverse.svg"),
      },
      onDidClick() {
        vscode.env.openExternal(vscode.Uri.parse(COSMOSDB_DOC_URL));
        appContext.reporter?.sendActionEvent(
          Telemetry.sources.homeDashboard,
          Telemetry.actions.click,
          Telemetry.targets.homeDashboard.toolbarLearnMore
        );
      },
    },
  ];
  const navElements: azdata.ButtonComponent[] = buttons.map((b) => {
    const component = view.modelBuilder.button().withProps(b).component();
    component.onDidClick(b.onDidClick);
    return component;
  });
  return view.modelBuilder
    .toolbarContainer()
    .withItems(navElements)
    .withLayout({ orientation: azdata.Orientation.Horizontal })
    .component();
};

const buildOverview = (view: azdata.ModelView): azdata.Component => {
  refreshProperties = () => {
    const connectionInfo = view.connection;
    retrieveDatabaseAccountInfoFromArm(
      connectionInfo.options["azureAccount"],
      connectionInfo.options["azureTenantId"],
      connectionInfo.options["azureResourceId"],
      connectionInfo.options["server"]
    ).then((databaseAccountInfo) => {
      const propertyItems: azdata.PropertiesContainerItem[] = [
        {
          displayName: localize("status", "Status"),
          value: databaseAccountInfo.serverStatus,
        },
        {
          displayName: localize("consistencyPolicy", "Consistency policy"),
          value: databaseAccountInfo.consistencyPolicy,
        },
        {
          displayName: localize("backupPolicy", "Backup policy"),
          value: databaseAccountInfo.backupPolicy,
        },
        {
          displayName: localize("readLocation", "Read location"),
          value: databaseAccountInfo.readLocations.join(","),
        },
      ];

      properties.propertyItems = propertyItems;
      component.loading = false;
    });
  };
  refreshProperties();

  const propertyItems: azdata.PropertiesContainerItem[] = [];
  const properties = view.modelBuilder.propertiesContainer().withProps({ propertyItems }).component();

  const overview = view.modelBuilder
    .divContainer()
    .withItems([properties])
    .withProps({
      CSSStyles: {
        padding: "10px",
        "border-bottom": "1px solid rgba(128, 128, 128, 0.35)",
      },
    })
    .component();

  const component = view.modelBuilder
    .loadingComponent()
    .withItem(overview)
    .withProps({
      loading: true,
    })
    .component();

  return component;
};

const buildGettingStarted = (
  view: azdata.ModelView,
  context: vscode.ExtensionContext,
  appContext: AppContext
): azdata.Component => {
  const addOpenInPortalButton = async (connectionInfo: azdata.ConnectionInfo) => {
    const portalEndpoint = await retrievePortalEndpoint(connectionInfo.options["azureAccount"]);
    const resourceId = await retrieveResourceId(
      connectionInfo.options["azureAccount"],
      connectionInfo.options["azureTenantId"],
      connectionInfo.options["azureResourceId"],
      getAccountName(connectionInfo)
    );
    heroCardsContainer.addItem(
      buildHeroCard(
        view,
        context.asAbsolutePath("resources/fluent/azure.svg"),
        localize("openInPortal", "Open in portal"),
        localize("openInPortalDescription", "View and manage this account (e.g. backup settings) in Azure portal"),
        () => {
          openInPortal(portalEndpoint, resourceId);
          appContext.reporter?.sendActionEvent(
            Telemetry.sources.homeDashboard,
            Telemetry.actions.click,
            Telemetry.targets.homeDashboard.gettingStartedOpenInPortal
          );
        }
      ),
      { flex: "0 0 auto" }
    );
  };

  const heroCards: azdata.ButtonComponent[] = [
    buildHeroCard(
      view,
      context.asAbsolutePath("resources/fluent/new-database.svg"),
      localize("newDatabase", "New Database"),
      localize("newDtabaseDescription", "Create database to store you data"),
      () => {
        const param: IConnectionNodeInfo = {
          connectionId: view.connection.connectionId,
          ...convertToConnectionOptions(view.connection),
        };
        vscode.commands
          .executeCommand("cosmosdb-ads-extension.createMongoDatabase", undefined, param)
          .then(() => refreshDatabases && refreshDatabases());
        appContext.reporter?.sendActionEvent(
          Telemetry.sources.homeDashboard,
          Telemetry.actions.click,
          Telemetry.targets.homeDashboard.gettingStartedNewDatabase
        );
      }
    ),
    buildHeroCard(
      view,
      context.asAbsolutePath("resources/fluent/mongo-shell.svg"),
      localize("openMongoShell", "Query Data with Mongo Shell"),
      localize("mongoShellDescription", "Interact with data using Mongo shell"),
      () => {
        vscode.commands.executeCommand("cosmosdb-ads-extension.openMongoShell", {
          connectionProfile: view.connection,
        });
        appContext.reporter?.sendActionEvent(
          Telemetry.sources.homeDashboard,
          Telemetry.actions.click,
          Telemetry.targets.homeDashboard.gettingStartedOpenMongoShell
        );
      }
    ),
    buildHeroCard(
      view,
      context.asAbsolutePath("resources/fluent/documentation.svg"),
      localize("documentation", "Documentation"),
      localize("documentation", "Find quickstarts, how-to guides, and references."),
      () => {
        vscode.env.openExternal(vscode.Uri.parse(COSMOSDB_DOC_URL));
        appContext.reporter?.sendActionEvent(
          Telemetry.sources.homeDashboard,
          Telemetry.actions.click,
          Telemetry.targets.homeDashboard.gettingStartedDocumentation
        );
      }
    ),
  ];

  const heroCardsContainer = view.modelBuilder
    .flexContainer()
    .withItems(heroCards, { flex: "0 0 auto" })
    .withLayout({ flexFlow: "row", flexWrap: "wrap" })
    .withProps({ CSSStyles: { width: "100%" } })
    .component();

  if (isAzureConnection(view.connection)) {
    addOpenInPortalButton(view.connection);
  }

  return view.modelBuilder
    .flexContainer()
    .withItems([
      view.modelBuilder
        .text()
        .withProps({
          value: localize("gettingStarted", "Getting started"),
          CSSStyles: { "font-size": "20px", "font-weight": "600" },
        })
        .component(),
      view.modelBuilder
        .text()
        .withProps({
          value: localize(
            "gettingStartedDescription",
            "Getting started with creating a new database, using mongo shell, viewing documentation, and managing via portal"
          ),
        })
        .component(),
      heroCardsContainer,
    ])
    .withLayout({ flexFlow: "column" })
    .withProps({
      CSSStyles: {
        padding: "10px",
      },
    })
    .component();
};

const buildTabArea = (
  view: azdata.ModelView,
  context: vscode.ExtensionContext,
  appContext: AppContext
): azdata.Component => {
  const input2 = view.modelBuilder.inputBox().withProps({ value: "input 2" }).component();

  const tabs: azdata.Tab[] = [
    {
      id: "tab1",
      content: buildGettingStarted(view, context, appContext),
      title: localize("gettingStarted", "Getting started"),
    },
    {
      id: "tab2",
      content: input2,
      title: localize("monitoring", "Monitoring"),
    },
  ];
  return view.modelBuilder
    .tabbedPanel()
    .withTabs(tabs)
    .withLayout({ orientation: azdata.TabOrientation.Horizontal })
    .withProps({
      CSSStyles: {
        height: "200px",
      },
    })
    .component();
};

const buildDatabasesAreaAzure = async (
  view: azdata.ModelView,
  context: vscode.ExtensionContext,
  appContext: AppContext
): Promise<azdata.Component> => {
  const connection = view.connection;
  let databases: ICosmosDbDatabaseInfo[];

  refreshDatabases = () => {
    retrieveMongoDbDatabasesInfoFromArm(
      connection.options["azureAccount"],
      connection.options["azureTenantId"],
      connection.options["azureResourceId"],
      getAccountName(connection)
    ).then((databasesInfo) => {
      databases = databasesInfo;
      tableComponent.data = databasesInfo.map((db) => [
        <azdata.HyperlinkColumnCellValue>{
          title: db.name,
          icon: context.asAbsolutePath("resources/fluent/database.svg"),
        },
        db.usageSizeKB === undefined ? localize("unknown", "Unknown") : db.usageSizeKB,
        db.nbCollections,
        <azdata.HyperlinkColumnCellValue>{
          title: db.throughputSetting,
        },
      ]);

      tableLoadingComponent.loading = false;
    });
  };
  refreshDatabases();

  const tableComponent = view.modelBuilder
    .table()
    .withProps({
      columns: [
        <azdata.HyperlinkColumn>{
          value: "database",
          type: azdata.ColumnType.hyperlink,
          name: localize("database", "Database"),
          width: 250,
        },
        {
          value: localize("dataUsage", "Data Usage (KB)"),
          type: azdata.ColumnType.text,
        },
        {
          value: localize("collection", "Collections"),
          type: azdata.ColumnType.text,
        },
        <azdata.HyperlinkColumn>{
          value: "throughput",
          type: azdata.ColumnType.hyperlink,
          name: localize("throughputSharedAccrossCollection", "Throughput Shared Across Collections"),
          width: 200,
        },
      ],
      data: [],
      height: 500,
      CSSStyles: {
        padding: "20px",
      },
    })
    .component();

  tableComponent.onCellAction &&
    tableComponent.onCellAction(async (arg: any /* Bug with definition: ICellActionEventArgs */) => {
      if (!databases) {
        return;
      }

      const databaseDashboardInfo: IDatabaseDashboardInfo = {
        databaseName: databases[arg.row].name,
        connectionId: connection.connectionId,
        ...convertToConnectionOptions(connection),
      };

      if (arg.name === "database") {
        vscode.commands.executeCommand(
          "cosmosdb-ads-extension.openDatabaseDashboard",
          undefined,
          databaseDashboardInfo
        );
        appContext.reporter?.sendActionEvent(
          Telemetry.sources.homeDashboard,
          Telemetry.actions.click,
          Telemetry.targets.homeDashboard.databasesListAzureOpenDashboard
        );
      } else if (arg.name === "throughput" && databases[arg.row].throughputSetting !== "") {
        try {
          const result = await changeMongoDbDatabaseThroughput(
            databaseDashboardInfo.azureAccount,
            databaseDashboardInfo.azureTenantId,
            databaseDashboardInfo.azureResourceId,
            getAccountNameFromOptions(databaseDashboardInfo),
            databases[arg.row]
          );
          if (result) {
            refreshDatabases && refreshDatabases();
          }
          appContext.reporter?.sendActionEvent(
            Telemetry.sources.homeDashboard,
            Telemetry.actions.click,
            Telemetry.targets.homeDashboard.databasesListAzureChangeThroughput
          );
        } catch (e: any) {
          vscode.window.showErrorMessage(e?.message);
        }
      }
    });

  const tableLoadingComponent = view.modelBuilder
    .loadingComponent()
    .withItem(tableComponent)
    .withProps({
      loading: true,
    })
    .component();

  return view.modelBuilder
    .flexContainer()
    .withItems([
      view.modelBuilder
        .text()
        .withProps({
          value: localize("databaseOverview", "Database overview"),
          CSSStyles: { "font-size": "20px", "font-weight": "600" },
        })
        .component(),
      view.modelBuilder
        .text()
        .withProps({
          value: localize("databaseOverviewDescription", "Click on a database for more details"),
        })
        .component(),
      tableLoadingComponent,
    ])
    .withLayout({ flexFlow: "column" })
    .withProps({ CSSStyles: { padding: "10px" } })
    .component();
};

const buildDatabasesAreaNonAzure = async (
  view: azdata.ModelView,
  context: vscode.ExtensionContext,
  appContext: AppContext
): Promise<azdata.Component> => {
  const server = view.connection.options["server"];
  let databases: IDatabaseInfo[];

  refreshDatabases = () => {
    appContext.listDatabases(server).then(async (dbs) => {
      databases = dbs;

      const databasesInfo: { name: string; nbCollections: number; sizeOnDisk: number | undefined }[] = [];
      for (const db of dbs) {
        const name = db.name;
        if (name !== undefined) {
          const nbCollections = (await appContext.listCollections(server, name)).length;
          databasesInfo.push({ name, nbCollections, sizeOnDisk: db.sizeOnDisk });
        }
      }
      tableComponent.data = databasesInfo.map((db) => [
        <azdata.HyperlinkColumnCellValue>{
          title: db.name,
          icon: context.asAbsolutePath("resources/fluent/database.svg"),
        },
        db.sizeOnDisk,
        db.nbCollections,
      ]);

      tableLoadingComponent.loading = false;
    });
  };
  refreshDatabases();

  const tableComponent = view.modelBuilder
    .table()
    .withProps({
      columns: [
        <azdata.HyperlinkColumn>{
          value: localize("database", "Database"),
          type: azdata.ColumnType.hyperlink,
          name: "Database",
          width: 250,
        },
        {
          value: localize("sizeOnDisk", "Size On Disk"),
          type: azdata.ColumnType.text,
        },
        {
          value: localize("collections", "Collections"),
          type: azdata.ColumnType.text,
        },
      ],
      data: [],
      height: 500,
      CSSStyles: {
        padding: "20px",
      },
    })
    .component();

  tableComponent.onCellAction &&
    tableComponent.onCellAction((arg: ICellActionEventArgs) => {
      if (!databases) {
        return;
      }

      const databaseDashboardInfo: IDatabaseDashboardInfo = {
        databaseName: databases[arg.row].name,
        connectionId: view.connection.connectionId,
        ...convertToConnectionOptions(view.connection),
      };
      vscode.commands.executeCommand("cosmosdb-ads-extension.openDatabaseDashboard", undefined, databaseDashboardInfo);
      appContext.reporter?.sendActionEvent(
        Telemetry.sources.homeDashboard,
        Telemetry.actions.click,
        Telemetry.targets.homeDashboard.databasesListNonAzureOpenDashboard
      );
    });

  const tableLoadingComponent = view.modelBuilder
    .loadingComponent()
    .withItem(tableComponent)
    .withProps({
      loading: true,
    })
    .component();

  return view.modelBuilder
    .flexContainer()
    .withItems([
      view.modelBuilder
        .text()
        .withProps({
          value: localize("databaseOverview", "Database overview"),
          CSSStyles: { "font-size": "20px", "font-weight": "600" },
        })
        .component(),
      view.modelBuilder
        .text()
        .withProps({
          value: localize("clickOnDatabaseDescription", "Click on a database for more details"),
        })
        .component(),
      tableLoadingComponent,
    ])
    .withLayout({ flexFlow: "column" })
    .withProps({ CSSStyles: { padding: "10px" } })
    .component();
};

export const registerHomeDashboardTabs = (context: vscode.ExtensionContext, appContext: AppContext): void => {
  azdata.ui.registerModelViewProvider("mongo-account-home", async (view) => {
    const viewItems: azdata.Component[] = [buildToolbar(view, context, appContext)];
    if (isAzureConnection(view.connection)) {
      viewItems.push(buildOverview(view));
    }
    viewItems.push(buildGettingStarted(view, context, appContext));

    const homeTabContainer = view.modelBuilder
      .flexContainer()
      // .withItems([buildToolbar(view, context), await buildOverview(view), buildTabArea(view, context)]) // Use this for monitoring tab
      .withItems(viewItems)
      .withLayout({ flexFlow: "column" })
      .component();
    await view.initializeModel(homeTabContainer);
  });

  azdata.ui.registerModelViewProvider("mongo-databases.tab", async (view) => {
    const viewItem = isAzureConnection(view.connection)
      ? await buildDatabasesAreaAzure(view, context, appContext)
      : await buildDatabasesAreaNonAzure(view, context, appContext);

    const homeTabContainer = view.modelBuilder
      .flexContainer()
      .withItems([buildToolbar(view, context, appContext), viewItem])
      .withLayout({ flexFlow: "column" })
      .component();
    await view.initializeModel(homeTabContainer);
  });
};

const openInPortal = (azurePortalEndpoint: string, azureResourceId: string) => {
  if (!azurePortalEndpoint || !azureResourceId) {
    vscode.window.showErrorMessage(localize("missingAzureInformation", "Missing azure information from connection"));
    return;
  }
  const url = `${azurePortalEndpoint}/#@microsoft.onmicrosoft.com/resource${azureResourceId}/overview`;
  vscode.env.openExternal(vscode.Uri.parse(url));
};
