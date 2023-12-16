# aps-revit-rcw-parameters-exchange

[![Node.js](https://img.shields.io/badge/Node.js-14.0-blue.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-6.0-blue.svg)](https://www.npmjs.com/)
![Platforms](https://img.shields.io/badge/Web-Windows%20%7C%20MacOS%20%7C%20Linux-lightgray.svg)

[![OAuth2](https://img.shields.io/badge/OAuth2-v2-green.svg)](http://developer.autodesk.com/)
[![Data-Management](https://img.shields.io/badge/Data%20Management-v1-green.svg)](http://developer.autodesk.com/)
[![Design-Automation](https://img.shields.io/badge/Design%20Automation-v3-green.svg)](http://developer.autodesk.com/)
[![APS-Viewer](https://img.shields.io/badge/APS%20Viewer-v7-green.svg)](http://developer.autodesk.com/)


![Windows](https://img.shields.io/badge/Plugins-Windows-lightgrey.svg)
![.NET](https://img.shields.io/badge/.NET%20Framework-4.8-blue.svg)
[![Revit-2024](https://img.shields.io/badge/Revit-2024-lightgrey.svg)](http://autodesk.com/revit)


![Advanced](https://img.shields.io/badge/Level-Advanced-red.svg)
[![MIT](https://img.shields.io/badge/License-MIT-blue.svg)](http://opensource.org/licenses/MIT)

# Description
This sample is based on [aps-revit-file-parameters-exchange](https://github.com/autodesk-platform-services/aps-revit-file-parameters-exchange), it works almost as same as [aps-revit-file-parameters-exchange](https://github.com/autodesk-platform-services/aps-revit-file-parameters-exchange), refer to that sample for the general workflow.

The only change of this sample is to support Revit Cloud Model. The sample demonstrates how to update a Revit Cloud Model stored in Autodesk Docs, using the new engine(later than Revit 2022) of Design Automation for Revit. 

The sample does two things:
1. export parameters (Door Type Parameter “Fire Rating”, and/or Door Instance Parameter “Comments”) of Revit Cloud Model to an excel file.
2. Import parameters (same as above) from a locally stored excel file to Revit Cloud Model.
 
The custom button in a viewer is provided to make it easier to see the parameter values. You can also see the values in the default property panel as well.

# Technique 
Highlight the technique change to support Revit Cloud Model:

1. The user's 3 Legged token is required by the Revit Design Automation plugin to handle the Revit Cloud Model, it can be passed as `adsk3LeggedTokenin` in the workitme as follow:

        {
            inputXls: {
                url: "XXXXXXXXXX"
            },
            onComplete: {
                verb: "post",
                    url: designAutomation.webhook_url
            },
            adsk3LeggedToken: access_token
        }

2. Instead of providing the storage link of the Revit model as input or output url, accessing the Revit Cloud Model only requires the Cloud information including `Region`, `ProjectGuid`, `ModelGuid`. These info can be passed within a JSON file in workitem, and Revit plugin  will open/save the Revit Cloud Model like: 

    `Open Revit Cloud Model` 

        var cloudModelPath = ModelPathUtils.ConvertCloudGUIDsToCloudPath(inputParams.Region, inputParams.ProjectGuid, inputParams.ModelGuid);
        Document doc = rvtApp.OpenDocumentFile(cloudModelPath, new OpenOptions());

    `Save Revit Cloud Model`

         if (doc.IsWorkshared)
         {
            SynchronizeWithCentralOptions swc = new SynchronizeWithCentralOptions();
            swc.SetRelinquishOptions(new RelinquishOptions(true));
            doc.SynchronizeWithCentral(new TransactWithCentralOptions(), swc);
         }
         else
         {
            // Single user cloud model
            doc.SaveCloudModel();
         }

3. Within the Revit plugin, Revit API cann only synchronize the work-shared model with central, no Revit API to publish the model, you can actually publish the Revit Cloud Model by [PublishModel API](https://aps.autodesk.com/en/docs/data/v2/reference/http/PublishModel/) in the `onComplete` callback like:

                const commandApi = new CommandsApi();
                await commandApi.publishModel( workitem.projectId, workitem.cloudModelBody,{}, req.oauth_client, workitem.access_token_3Legged );


# Thumbnail
![thumbnail](/thumbnail.png)

# Demonstration
[![https://youtu.be/nOAEzimdq5Q](http://img.youtube.com/vi/nOAEzimdq5Q/0.jpg)](http://www.youtube.com/watch?v=nOAEzimdq5Q "Export|Import Revit Cloud Model parameter values to|from Excel")

`Note:` The video is for file-based Revit model, but the workflow should be same for Revit Cloud Model.  

# Main Parts of The Work
1. Create a Revit Plugin to be used within AppBundle of Design Automation for Revit. Please check [PlugIn](./ExportImportExcelPlugin/) 

2. Create your App, upload the AppBundle, define your Activity, you can refer ([https://youtu.be/1NCeH7acIko](https://youtu.be/1NCeH7acIko)) and simply use the `Configure` button in the Web Application to create the Appbundle & Activity. 

3. Create the Web App to call the workitem.

# Web App Setup

## Prerequisites

1. **APS Account**: Learn how to create a APS Account, activate subscription and create an app at [this tutorial](http://aps.autodesk.com/tutorials). 
2. **Visual Code**: Visual Code (Windows or MacOS).
3. **ngrok**: Routing tool, [download here](https://ngrok.com/)
4. **Revit 2023**: required to compile changes into the plugin
5. **JavaScript ES6** syntax for server-side.
6. **JavaScript** basic knowledge with **jQuery**


For using this sample, you need an Autodesk developer credentials. Visit the [APS Developer Portal](https://developer.autodesk.com), sign up for an account, then [create an app](https://developer.autodesk.com/myapps/create). For this new app, use **http://localhost:3000/api/aps/callback/oauth** as Callback URL, although is not used on 2-legged flow. Finally take note of the **Client ID** and **Client Secret**.

## Running locally

Install [NodeJS](https://nodejs.org), version 14 or newer.

Clone this project or download it (this `nodejs` branch only). It's recommended to install [GitHub desktop](https://desktop.github.com/). To clone it via command line, use the following (**Terminal** on MacOSX/Linux, **Git Shell** on Windows):

    git clone https://github.com/autodesk-platform-services/aps-revit-rcw-parameters-exchange

Install the required packages using `npm install`.

### ngrok

Run `ngrok http 3000` to create a tunnel to your local machine, then copy the address into the `APS_WEBHOOK_URL` environment variable. Please check [WebHooks](https://aps.autodesk.com/en/docs/webhooks/v1/tutorials/configuring-your-server/) for details.

### Environment variables

Set the environment variables with your client ID & secret and finally start it. Via command line, navigate to the folder where this repository was cloned and use the following:

Mac OSX/Linux (Terminal)

    npm install
    export APS_CLIENT_ID=<<YOUR CLIENT ID FROM DEVELOPER PORTAL>>
    export APS_CLIENT_SECRET=<<YOUR CLIENT SECRET>>
    export APS_CALLBACK_URL=<<YOUR CALLBACK URL>>
    export APS_WEBHOOK_URL=<<YOUR DESIGN AUTOMATION FOR REVIT CALLBACK URL>>
    export DESIGN_AUTOMATION_NICKNAME=<<YOUR DESIGN AUTOMATION FOR REVIT NICK NAME>>
    export DESIGN_AUTOMATION_ACTIVITY_NAME=<<YOUR DESIGN AUTOMATION FOR REVIT ACTIVITY NAME>>
    npm start

Windows (use **Node.js command line** from Start menu)

    npm install
    set APS_CLIENT_ID=<<YOUR CLIENT ID FROM DEVELOPER PORTAL>>
    set APS_CLIENT_SECRET=<<YOUR CLIENT SECRET>>
    set APS_CALLBACK_URL=<<YOUR CALLBACK URL>>
    set APS_WEBHOOK_URL=<<YOUR DESIGN AUTOMATION FOR REVIT CALLBACK URL>>
    set DESIGN_AUTOMATION_NICKNAME=<<YOUR DESIGN AUTOMATION FOR REVIT NICK NAME>>
    set DESIGN_AUTOMATION_ACTIVITY_NAME=<<YOUR DESIGN AUTOMATION FOR REVIT ACTIVITY NAME>>
    npm start

Windows (use **PowerShell**)

    npm install
    $env:APS_CLIENT_ID="YOUR CLIENT ID FROM DEVELOPER PORTAL"
    $env:APS_CLIENT_SECRET="YOUR CLIENT SECRET"
    $env:APS_CALLBACK_URL="YOUR CALLBACK URL"
    $env:APS_WEBHOOK_URL="YOUR DESIGN AUTOMATION FOR REVIT CALLBACK URL"
    $env:DESIGN_AUTOMATION_NICKNAME="YOUR DESIGN AUTOMATION FOR REVIT NICK NAME"
    $env:DESIGN_AUTOMATION_ACTIVITY_NAME="YOUR DESIGN AUTOMATION FOR REVIT ACTIVITY NAME"
    npm start

**Note.**
environment variable examples:
- APS_CALLBACK_URL: `http://localhost:3000/api/aps/callback/oauth`
- APS_WEBHOOK_URL: `http://808efcdc123456.ngrok.io/api/aps/callback/designautomation`

The following are optional:
- DESIGN_AUTOMATION_NICKNAME: Only necessary if there is a nickname, APS client id by default.
- DESIGN_AUTOMATION_ACTIVITY_NAME: Only necessary if the activity name is customized, ExportImportExcelActivity by default.

### Using the app

Open the browser: [http://localhost:3000](http://localhost:3000), it provides the abilities to export & import parameter with Excel: 

1. Select Revit Cloud Model file version in Autodesk Docs to view the Model, Select parameters which you want to export|import, choose either export or import and click 'Execute'.
2. Select the Door type or instance in Model Viewer, and open the customized property panel to see the result.

`Note`: When you deploy the app, you have to open the `Configure` button to create the AppBundle & Activity before running the Export|Import feature, please check the video for the steps at [https://youtu.be/1NCeH7acIko](https://youtu.be/1NCeH7acIko). You can also delete the existing AppBundle & Activity and re-create with different Design Automation Revit engine version.

## Packages used

The [Autodesk APS](https://www.npmjs.com/package/forge-apis) packages is included by default. Some other non-Autodesk packaged are used, including [socket.io](https://www.npmjs.com/package/socket.io), [express](https://www.npmjs.com/package/express).

Within the Revit Plugin, [LibXL](http://www.libxl.com) is used to read/write the date of Excel. 

## Further Reading

Documentation:
- [Design Automation API](https://aps.autodesk.com/en/docs/design-automation/v3/developers_guide/overview/)
- [BIM 360 API](https://developer.autodesk.com/en/docs/bim360/v1/overview/) and [App Provisioning](https://aps.autodesk.com/blog/bim-360-docs-provisioning-forge-apps)
- [Data Management API](httqqqps://developer.autodesk.com/en/docs/data/v2/overview/)

Desktop APIs:

- [Revit](https://knowledge.autodesk.com/support/revit-products/learn-explore/caas/simplecontent/content/my-first-revit-plug-overview.html)

## Limitation
- The free version of [LibXL](http://www.libxl.com) I used will write a banner in the first row of each spreadsheet and it will be able to read only 300 cells (first row is unavailable). If you want to remove banner and reading restriction, you may contact them for a license.
- The current version only works for US region, will improve to support EU region later.  

## Tips & Tricks
- Before using the sample to call the workitem, you need to setup your Appbundle & Activity of Design Automation, you can follow my Postman script to understand the whole process, or you can simply use the `Configure` button in the Web Application to create the Appbundle & Activity([https://youtu.be/1NCeH7acIko](https://youtu.be/1NCeH7acIko)). 
- It takes time for Autodesk Docs to automatically translate the new published Revit Cloud Model, please wait for a while to see the viewable and properties.


## License

This sample is licensed under the terms of the [MIT License](http://opensource.org/licenses/MIT). Please see the [LICENSE](LICENSE) file for full details.

## Written by

Zhong Wu [@johnonsoftware](https://twitter.com/johnonsoftware), [Autodesk Partner Development](http://aps.autodesk.com)
