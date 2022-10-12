/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Forge Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

const express = require('express');
const { credentials }= require('../config');

const {
    BucketsApi,
    ObjectsApi,
    CommandsApi,
} = require('forge-apis');

const { OAuth } = require('./common/oauthImp');

const { 
    delay,
    getWorkitemStatus, 
    cancelWorkitem,
    exportExcel,
    importExcel,
    createBodyOfPublishCloudModel,
    workitemList 
} = require('./common/da4revitImp');

const SOCKET_TOPIC_WORKITEM = 'Workitem-Notification';
const Temp_Output_File_Name = 'RevitParams.xls';

let router = express.Router();


///////////////////////////////////////////////////////////////////////
/// Middleware for obtaining a token for each request.
///////////////////////////////////////////////////////////////////////
router.use(async (req, res, next) => {
    const oauth = new OAuth(req.session);
    let credentials = await oauth.getInternalToken();
    let oauth_client = oauth.getClient();

    if(credentials ){
        req.oauth_client = oauth_client;
        req.oauth_token = credentials;
        next();
    }
});



///////////////////////////////////////////////////////////////////////
/// Export parameters to Excel from Revit
///////////////////////////////////////////////////////////////////////
router.get('/da4revit/v1/revit/excel', async (req, res, next) => {
    const inputJson = req.query;
    if ( inputJson === '' ) {
        res.status(400).end('make sure the input version id has correct value');
        return;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // use 2 legged token for design automation
    const oauth = new OAuth(req.session);
    const oauth_client = oauth.get2LeggedClient();;
    const oauth_token = await oauth_client.authenticate();

    // create the temp output storage
    const bucketKey = credentials.client_id.toLowerCase() + '_designautomation';
    const opt = {
        bucketKey: bucketKey,
        policyKey: 'transient',
    }
    try {
        await new BucketsApi().createBucket(opt, {}, oauth_client, oauth_token);
    } catch (err) { // catch the exception while bucket is already there
    };

    try {
        // migrate to use new S3 upload API
        const objectApi = new ObjectsApi();
        var response = await objectApi.getS3UploadURL(bucketKey, Temp_Output_File_Name, null, oauth_client, oauth_token);
        const signedS3Info = {
            BucketKey: bucketKey,
            ObjectKey: Temp_Output_File_Name,
            UploadKey: response.body.uploadKey
        };
        let result = await exportExcel( inputJson, response.body.urls[0], signedS3Info, req.oauth_token, oauth_token);
        if (result === null || result.statusCode !== 200) {
            console.log('failed to export the excel file');
            res.status(500).end('failed to export the excel file');
            return;
        }
        console.log('Submitted the workitem: ' + result.body.id);
        const exportInfo = {
            "workItemId": result.body.id,
            "workItemStatus": result.body.status,
            "ExtraInfo": null
        };
        res.status(200).end(JSON.stringify(exportInfo));
    } catch (err) {
        console.log('get exception while exporting parameters to Excel')
        let workitemStatus = {
            'Status': "Failed"
        };
        global.MyApp.SocketIo.emit(SOCKET_TOPIC_WORKITEM, workitemStatus);
        res.status(500).end(JSON.stringify(err));
    }
});




///////////////////////////////////////////////////////////////////////
/// Import parameters from Excel to Revit Cloud Model
///
///////////////////////////////////////////////////////////////////////
router.post('/da4revit/v1/revit/excel', async (req, res, next) => {
    const inputExcUrl  = req.body.InputExcUrl; // input Url of Excel file
    const inputJson  = req.body.Data;    // input parameters for DA
    const fileItemId   = req.body.ItemUrl; // item url used to get info to pulish Revit cloud model.
    const fileItemName = req.body.FileItemName; // file name


    if ( inputJson === '' || inputExcUrl === '' || fileItemName === '' || fileItemId === '') {
        res.status(400).end('Missing input data');
        return;
    }

    const params = fileItemId.split('/');
    if( params.length < 3){
        res.status(400).end('input ItemUrl is not in correct format');
    }

    const resourceName = params[params.length - 2];
    if (resourceName !== 'items') {
        res.status(400).end('input ItemUrl is not an item');
        return;
    }

    const itemId = params[params.length - 1];
    const projectId = params[params.length - 3];

    try {
        const publishCloudModelBody = createBodyOfPublishCloudModel( itemId);
        ////////////////////////////////////////////////////////////////////////////////
        // use 2 legged token for design automation
        const oauth = new OAuth(req.session);
        const oauth_client = oauth.get2LeggedClient();;
        const oauth_token = await oauth_client.authenticate();

        // call to import Excel file to update parameters in Revit
        let result = await importExcel(inputExcUrl, inputJson, projectId, publishCloudModelBody, req.oauth_token, oauth_token);
        if (result === null || result.statusCode !== 200) {
            console.log('failed to import parameters to the revit cloud model');
            res.status(500).end('failed to import parameters to the revit cloud model');
            return;
        }
        console.log('Submitted the workitem: '+ result.body.id);
        const exportInfo = {
            "workItemId": result.body.id,
            "workItemStatus": result.body.status,
            "ExtraInfo": null
        };
        res.status(200).end(JSON.stringify(exportInfo));

    } catch (err) {
        console.log('get exception while importing parameters from Excel '+err)
        let workitemStatus = {
            'Status': "Failed"
        };
        global.MyApp.SocketIo.emit(SOCKET_TOPIC_WORKITEM, workitemStatus);
        res.status(500).end(JSON.stringify(err));
    }
});


///////////////////////////////////////////////////////////////////////
/// Cancel the file workitem process if possible.
/// NOTE: This may not successful if the workitem process is already started
///////////////////////////////////////////////////////////////////////
router.delete('/da4revit/v1/revit/:workitem_id', async(req, res, next) =>{

    const workitemId = req.params.workitem_id;
    try {
        const oauth = new OAuth(req.session);
        const oauth_client = oauth.get2LeggedClient();;
        const oauth_token = await oauth_client.authenticate();
        await cancelWorkitem(workitemId, oauth_token.access_token);
        let workitemStatus = {
            'WorkitemId': workitemId,
            'Status': "Cancelled"
        };

        const workitem = workitemList.find( (item) => {
            return item.workitemId === workitemId;
        } )
        if( workitem === undefined ){
            console.log('the workitem is not in the list')
            return;
        }
        console.log('The workitem: ' + workitemId + ' is cancelled')
        let index = workitemList.indexOf(workitem);
        workitemList.splice(index, 1);

        global.MyApp.SocketIo.emit(SOCKET_TOPIC_WORKITEM, workitemStatus);
        res.status(204).end();
    } catch (err) {
        res.status(500).end("error");
    }
})

///////////////////////////////////////////////////////////////////////
/// Query the status of the workitem
///////////////////////////////////////////////////////////////////////
router.get('/da4revit/v1/revit/:workitem_id', async(req, res, next) => {
    const workitemId = req.params.workitem_id;
    try {
        const oauth = new OAuth(req.session);
        const oauth_client = oauth.get2LeggedClient();;
        const oauth_token = await oauth_client.authenticate();        
        let workitemRes = await getWorkitemStatus(workitemId, oauth_token.access_token);
        res.status(200).end(JSON.stringify(workitemRes.body));
    } catch (err) {
        res.status(500).end("error");
    }
})


///////////////////////////////////////////////////////////////////////
///
///////////////////////////////////////////////////////////////////////
router.post('/callback/designautomation', async (req, res, next) => {
    // Best practice is to tell immediately that you got the call
    // so return the HTTP call and proceed with the business logic
    res.status(202).end();

    let workitemStatus = {
        'WorkitemId': req.body.id,
        'Status': "Success",
        'ExtraInfo' : null
    };
    if (req.body.status === 'success') {
        const workitem = workitemList.find( (item) => {
            return item.workitemId === req.body.id;
        } )

        if( workitem === undefined ){
            console.log('The workitem: ' + req.body.id+ ' to callback is not in the item list')
            return;
        }
        let index = workitemList.indexOf(workitem);

        // publish the cloud model if it's changed
        if (workitem.cloudModelBody != null ) {
            workitemStatus.Status = 'Success';
            global.MyApp.SocketIo.emit(SOCKET_TOPIC_WORKITEM, workitemStatus);
            console.log("Publish the latest cloud model for the workitem:  " + workitem.workitemId);
            const itemId = workitem.cloudModelBody.data.relationships.resources.data[0].id;
            try{
                const commandApi = new CommandsApi();
                await commandApi.publishModel( workitem.projectId, workitem.cloudModelBody,{}, req.oauth_client, workitem.access_token_3Legged );
                // check if the revit cloud model is published successfully
                let retryTime = 3;
                while (retryTime-- > 0) {
                    await delay(5000);
                    const statusRes = await commandApi.getPublishModelJob(workitem.projectId, workitem.cloudModelBody, {}, req.oauth_client, workitem.access_token_3Legged);
                    if (statusRes.body.data && statusRes.body.data.attributes.status === "complete")
                        break;
                }
                console.log('Successfully published a new version of the file');
                workitemStatus.Status = 'Completed';
            }catch(err){
                console.log("Failed to publish the cloud model due to "+ err);
                workitemStatus.Status = 'Failed';
            }
        } else if( workitem.signedS3Info ) {
            // Call to complete the S3 upload the excel file.
            try{
                const objectApi = new ObjectsApi();
                const res = await objectApi.completeS3Upload(workitem.signedS3Info.BucketKey, workitem.signedS3Info.ObjectKey, { uploadKey: workitem.signedS3Info.UploadKey }, null, req.oauth_client, workitem.access_token_2Legged)
                const downloadInfo = await objectApi.getS3DownloadURL( res.body.bucketKey, res.body.objectKey, null, req.oauth_client, workitem.access_token_2Legged );
                workitemStatus.Status = 'Completed';
                workitemStatus.ExtraInfo = downloadInfo.body.url;
            }catch(err){
                console.log("Failed to upload the output excel due to "+ err);
                workitemStatus.Status = 'Failed';
            }
        }else{
            workitemStatus.Status = 'Failed';
        }
        global.MyApp.SocketIo.emit(SOCKET_TOPIC_WORKITEM, workitemStatus);
        // Remove the workitem after it's done
        workitemList.splice(index, 1);
    }else{
        // Report if not successful.
        workitemStatus.Status = 'Failed';
        global.MyApp.SocketIo.emit(SOCKET_TOPIC_WORKITEM, workitemStatus);
        console.log(req.body);
    }
    return;
})


module.exports = router;
