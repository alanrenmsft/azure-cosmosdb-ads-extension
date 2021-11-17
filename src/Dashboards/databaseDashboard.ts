/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from "azdata";
import { ICellActionEventArgs } from "azdata";
import * as vscode from "vscode";
import { retrieveMongoDbCollectionsInfoFromArm } from "../appContext";
import { createNodePath } from "../Providers/objectExplorerNodeProvider";

interface IButtonData {
  label: string;
  icon?: string;
  onClick?: () => void;
}

const buildToolbar = (
  view: azdata.ModelView,
  context: vscode.ExtensionContext,
  databaseName: string,
  connection: azdata.ConnectionInfo
): azdata.ToolbarContainer => {
  const buttons: (azdata.ButtonProperties & { onDidClick: () => void })[] = [
    {
      label: "New Collection",
      iconPath: {
        light: context.asAbsolutePath("images/AddDatabase.svg"),
        dark: context.asAbsolutePath("images/AddDatabase.svg"),
      },
      onDidClick: () =>
        vscode.commands.executeCommand("cosmosdb-ads-extension.createMongoCollection", {
          connectionProfile: connection,
          nodeInfo: {
            nodePath: createNodePath("server", databaseName),
          },
        }),
    },
  ];
  const navElements: azdata.ButtonComponent[] = buttons.map((b) => {
    const component = view.modelBuilder.button().withProperties(b).component();
    component.onDidClick(b.onDidClick);
    return component;
  });
  return view.modelBuilder
    .toolbarContainer()
    .withItems(navElements)
    .withLayout({ orientation: azdata.Orientation.Horizontal })
    .component();
};

const buildHeroCard = (
  view: azdata.ModelView,
  iconPath: string,
  title: string,
  description: string,
  onClick: () => void
): azdata.ButtonComponent => {
  const button = view.modelBuilder
    .button()
    .withProperties<azdata.ButtonProperties>({
      // buttonType: azdata.ButtonType.Informational,
      // description,
      height: 84,
      iconHeight: 32,
      iconPath,
      iconWidth: 32,
      label: title,
      title,
      width: 236,
    })
    .component();
  button.onDidClick(onClick); // TODO Make sure to manage disposable (unlisten)
  return button;
};

const buildWorkingWithDatabase = (
  view: azdata.ModelView,
  context: vscode.ExtensionContext,
  databaseName: string,
  connection: azdata.ConnectionInfo
): azdata.Component => {
  const heroCards: azdata.ButtonComponent[] = [
    buildHeroCard(
      view,
      context.asAbsolutePath("images/AddDatabase.svg"),
      "New Collection",
      "Create a new collection to store you data",
      () =>
        vscode.commands.executeCommand("cosmosdb-ads-extension.createMongoCollection", {
          connectionProfile: connection,
          nodeInfo: {
            nodePath: createNodePath("server", databaseName),
          },
        })
    ),
    buildHeroCard(
      view,
      context.asAbsolutePath("images/AddDatabase.svg"),
      "Sample collection",
      "Create a new collection using one of our sample datasets",
      () => {}
    ),
  ];

  const heroCardsContainer = view.modelBuilder
    .flexContainer()
    .withItems(heroCards)
    .withLayout({ flexFlow: "row", flexWrap: "wrap" })
    .withProperties({ CSSStyles: { width: "100%" } })
    .component();

  return view.modelBuilder
    .flexContainer()
    .withItems([
      view.modelBuilder
        .text()
        .withProperties({
          value: "Getting started",
          CSSStyles: { "font-family": "20px", "font-weight": "600" },
        })
        .component(),
      heroCardsContainer,
    ])
    .withLayout({ flexFlow: "column" })
    .withProperties({
      CSSStyles: {
        padding: "10px",
      },
    })
    .component();
};

const buildCollectionsArea = async (
  databaseName: string,
  view: azdata.ModelView,
  context: vscode.ExtensionContext,
  connectionInfo: azdata.ConnectionInfo
): Promise<azdata.Component> => {
  const collectionsInfo = await retrieveMongoDbCollectionsInfoFromArm(connectionInfo, databaseName);

  const tableComponent = view.modelBuilder
    .table()
    .withProperties<azdata.TableComponentProperties>({
      columns: [
        <azdata.HyperlinkColumn>{
          value: "Collection",
          type: azdata.ColumnType.hyperlink,
          name: "Collection",
          width: 250,
        },
        {
          value: "Data Usage (KB)", // TODO Translate
          type: azdata.ColumnType.text,
        },
        {
          value: "Documents", // TODO Translate
          type: azdata.ColumnType.text,
        },
        {
          value: "Throughput", // TODO translate
          type: azdata.ColumnType.text,
        },
      ],
      data: collectionsInfo.map((collection) => [
        <azdata.HyperlinkColumnCellValue>{
          title: collection.name,
          icon: context.asAbsolutePath("images/tree-collection.svg"),
        },
        collection.usageSizeKB === undefined ? "Unknown" : collection.usageSizeKB,
        collection.documentCount === undefined ? "Unknown" : collection.documentCount,
        collection.throughputSetting,
      ]),
      height: 500,
      CSSStyles: {
        padding: "20px",
      },
    })
    .component();

  if (tableComponent.onCellAction) {
    tableComponent.onCellAction((arg: ICellActionEventArgs) => {
      vscode.window.showInformationMessage(
        `clicked: ${arg.row} row, ${arg.column} column, ${arg.columnName} columnName`
      );
    });
  }

  // tableComponent.onRowSelected((arg: any) => {
  // 	vscode.window.showInformationMessage(`clicked: ${arg.toString()}`);
  // });

  return view.modelBuilder
    .flexContainer()
    .withItems([
      view.modelBuilder
        .text()
        .withProperties({
          value: "Collection overview",
          CSSStyles: { "font-size": "20px", "font-weight": "600" },
        })
        .component(),
      view.modelBuilder
        .text()
        .withProperties({
          value: "Click on a collection to work with the data",
        })
        .component(),
      tableComponent,
    ])
    .withLayout({ flexFlow: "column" })
    .withProperties({ CSSStyles: { padding: "10px" } })
    .component();
};

export const openDatabaseDashboard = async (
  azureAccountId: string,
  databaseName: string,
  context: vscode.ExtensionContext
): Promise<void> => {
  const connectionInfo = (await azdata.connection.getConnections()).filter(
    (connectionInfo) => connectionInfo.options["azureAccount"] === azureAccountId
  )[0];
  if (!connectionInfo) {
    // TODO Handle error here
    vscode.window.showErrorMessage("no valid connection found");
    return;
  }

  const dashboard = azdata.window.createModelViewDashboard(databaseName);
  dashboard.registerTabs(async (view: azdata.ModelView) => {
    const input1 = view.modelBuilder
      .inputBox()
      .withProperties<azdata.InputBoxProperties>({ value: databaseName })
      .component();

    const homeTabContainer = view.modelBuilder
      .flexContainer()
      .withItems([
        buildWorkingWithDatabase(view, context, databaseName, connectionInfo),
        await buildCollectionsArea(databaseName, view, context, connectionInfo),
      ])
      .withLayout({ flexFlow: "column" })
      .component();

    const homeTab: azdata.DashboardTab = {
      id: "home",
      toolbar: buildToolbar(view, context, databaseName, connectionInfo),
      content: homeTabContainer,
      title: "Home",
      icon: context.asAbsolutePath("images/home.svg"), // icon can be the path of a svg file
    };

    const databasesTab: azdata.DashboardTab = {
      id: "collections",
      content: input1,
      title: "collections",
      icon: context.asAbsolutePath("images/tree-collection.svg"), // icon can be the path of a svg file
    };

    return [homeTab, databasesTab];
  });
  await dashboard.open();
};
