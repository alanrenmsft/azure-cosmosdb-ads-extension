import { ServerProvider, IConfig, Events } from "@microsoft/ads-service-downloader";
import * as path from "path";
import { promises as fs } from "fs";
import * as vscode from "vscode";

export const downloadMongoShell = async (extensionPath: string): Promise<string> => {
  const rawConfig = await fs.readFile(path.join(extensionPath, "mongoShellConfig.json"));
  const config = JSON.parse(rawConfig.toString())!;
  config.installDirectory = path.join(extensionPath, config.installDirectory);
  config.proxy = vscode.workspace.getConfiguration("http").get<string>("proxy")!;
  config.strictSSL = vscode.workspace.getConfiguration("http").get("proxyStrictSSL") || true;

  const serverdownloader = new ServerProvider(config);
  serverdownloader.eventEmitter.onAny(() => generateHandleServerProviderEvent());
  return serverdownloader.getOrDownloadServer();
};

const statusView = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
const outputChannel = vscode.window.createOutputChannel("download");

function generateHandleServerProviderEvent() {
  let dots = 0;
  return (e: string, ...args: any[]) => {
    switch (e) {
      case Events.INSTALL_START:
        outputChannel.show(true);
        statusView.show();
        // outputChannel.appendLine(localize('installingServiceChannelMsg', "Installing {0} to {1}", Constants.serviceName, args[0]));
        // statusView.text = localize('installingServiceStatusMsg', "Installing {0}", Constants.serviceName);
        outputChannel.appendLine(`Installing MongoShell to ${args[0]}`);
        statusView.text = `Installing MongoShell to ${args[0]}`;
        break;
      case Events.INSTALL_END:
        // outputChannel.appendLine(localize('installedServiceChannelMsg', "Installed {0}", Constants.serviceName));
        outputChannel.appendLine("Installed MongoShell");
        break;
      case Events.DOWNLOAD_START:
        // outputChannel.appendLine(localize('downloadingServiceChannelMsg', "Downloading {0}", args[0]));
        // outputChannel.append(localize('downloadingServiceSizeChannelMsg', "({0} KB)", Math.ceil(args[1] / 1024).toLocaleString(vscode.env.language)));
        outputChannel.appendLine(`Downloading ${args[0]}`);
        outputChannel.append(`(${Math.ceil(args[1] / 1024).toLocaleString(vscode.env.language)} KB)`);
        // statusView.text = localize('downloadingServiceStatusMsg', "Downloading {0}", Constants.serviceName);
        statusView.text = "Downloading MongoShell";
        break;
      case Events.DOWNLOAD_PROGRESS:
        let newDots = Math.ceil(args[0] / 5);
        if (newDots > dots) {
          outputChannel.append(".".repeat(newDots - dots));
          dots = newDots;
        }
        break;
      case Events.DOWNLOAD_END:
        // outputChannel.appendLine(localize('downloadServiceDoneChannelMsg', "Done installing {0}", Constants.serviceName));
        outputChannel.appendLine("Done installing MongoShell");
        break;
      default:
        console.error(`Unknown event from Server Provider ${e}`);
        break;
    }
  };
}
