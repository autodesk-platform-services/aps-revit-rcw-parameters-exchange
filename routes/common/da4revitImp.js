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
const request = require("request");

const { designAutomation }= require('../../config');



var workitemList = [];


// helper function to sleep 
function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
}

///////////////////////////////////////////////////////////////////////
///
///
///////////////////////////////////////////////////////////////////////
function getWorkitemStatus(workItemId, access_token) {

    return new Promise(function (resolve, reject) {

        var options = {
            method: 'GET',
            url: designAutomation.endpoint +'workitems/'+ workItemId,
            headers: {
                Authorization: 'Bearer ' + access_token,
                'Content-Type': 'application/json'
            }
        };

        request(options, function (error, response, body) {
            if (error) {
                reject(err);
            } else {
                let resp;
                try {
                    resp = JSON.parse(body)
                } catch (e) {
                    resp = body
                }
                if (response.statusCode >= 400) {
                    console.log('error code: ' + response.statusCode + ' response message: ' + response.statusMessage);
                    reject({
                        statusCode: response.statusCode,
                        statusMessage: response.statusMessage
                    });
                } else {
                    resolve({
                        statusCode: response.statusCode,
                        headers: response.headers,
                        body: resp
                    });
                }
            }
        });
    });
}

///////////////////////////////////////////////////////////////////////
///
///
///////////////////////////////////////////////////////////////////////
function cancelWorkitem(workItemId, access_token) {

    return new Promise(function (resolve, reject) {

        var options = {
            method: 'DELETE',
            url: designAutomation.endpoint +'workitems/'+ workItemId,
            headers: {
                Authorization: 'Bearer ' + access_token,
                'Content-Type': 'application/json'
            }
        };

        request(options, function (error, response, body) {
            if (error) {
                reject(err);
            } else {
                let resp;
                try {
                    resp = JSON.parse(body)
                } catch (e) {
                    resp = body
                }
                if (response.statusCode >= 400) {
                    console.log('error code: ' + response.statusCode + ' response message: ' + response.statusMessage);
                    reject({
                        statusCode: response.statusCode,
                        statusMessage: response.statusMessage
                    });
                } else {
                    resolve({
                        statusCode: response.statusCode,
                        headers: response.headers,
                        body: resp
                    });
                }
            }
        });
    });
}


function importExcel( inputExcUrl, inputJson, projectId, publishCloudModelBody, access_token_3Legged, access_token_2Legged){
    return new Promise(function (resolve, reject) {

        const workitemBody = {

            activityId: designAutomation.nickname + '.' + designAutomation.activity_name + '+'+ designAutomation.appbundle_activity_alias,
            arguments: {
                inputJson: {
                    url: "data:application/json," + JSON.stringify(inputJson)
                },
                inputXls: {
                    url: inputExcUrl,
                },
                adsk3LeggedToken:access_token_3Legged.access_token,
                onComplete: {
                    verb: "post",
                    url: designAutomation.webhook_url
                }
            }
        };

        var options = {
            method: 'POST',
            url: designAutomation.endpoint+'workitems',
            headers: {
                Authorization: 'Bearer ' + access_token_2Legged.access_token,
                'Content-Type': 'application/json'
            },
            body: workitemBody,
            json: true
        };

        request(options, function (error, response, body) {
            if (error) {
                reject(error);
            } else {
                let resp;
                try {
                    resp = JSON.parse(body)
                } catch (e) {
                    resp = body
                }
                workitemList.push({
                    workitemId: resp.id,
                    projectId: projectId,
                    cloudModelBody: publishCloudModelBody,
                    access_token_3Legged: access_token_3Legged
                })

                if (response.statusCode >= 400) {
                    console.log('error code: ' + response.statusCode + ' response message: ' + response.statusMessage);
                    reject({
                        statusCode: response.statusCode,
                        statusMessage: response.statusMessage
                    });
                } else {
                    resolve({
                        statusCode: response.statusCode,
                        headers: response.headers,
                        body: resp
                    });
                }
            }
        });
    })    
}


function exportExcel( inputJson, outputExlUrl, signedS3Info, access_token_3Legged, access_token_2Legged) {

    return new Promise(function (resolve, reject) {

        const workitemBody = {
                activityId: designAutomation.nickname + '.'+designAutomation.activity_name + '+'+ designAutomation.appbundle_activity_alias,
                arguments: {
                    inputJson: { 
                        url: "data:application/json,"+ JSON.stringify(inputJson)
                     },

                     outputXls: {
                        verb: 'put',
                        url: outputExlUrl
                    },
                    onComplete: {
                        verb: "post",
                        url: designAutomation.webhook_url
                    },
                    adsk3LeggedToken: access_token_3Legged.access_token
                }
        };    
        var options = {
            method: 'POST',
            url: designAutomation.endpoint+'workitems',
            headers: {
                Authorization: 'Bearer ' + access_token_2Legged.access_token,
                'Content-Type': 'application/json'
            },
            body: workitemBody,
            json: true
        };

        request(options, function (error, response, body) {
            if (error) {
                reject(error);
            } else {
                let resp;
                try {
                    resp = JSON.parse(body)
                } catch (e) {
                    resp = body
                }
                workitemList.push({
                    workitemId: resp.id,
                    signedS3Info: signedS3Info,
                    access_token_2Legged: access_token_2Legged
                })

                if (response.statusCode >= 400) {
                    console.log('error code: ' + response.statusCode + ' response message: ' + response.statusMessage);
                    reject({
                        statusCode: response.statusCode,
                        statusMessage: response.statusMessage
                    });
                } else {
                    resolve({
                        statusCode: response.statusCode,
                        headers: response.headers,
                        body: resp
                    });
                }
            }
        });
    })

}




function createBodyOfPublishCloudModel(itemId) {

    return {
        "jsonapi": {
            "version": "1.0"
        },
        "data": {
            "type": "commands",
            "attributes": {
                "extension": {
                    "type": "commands:autodesk.bim360:C4RModelPublish",
                    "version": "1.0.0"
                }
            },
            "relationships": {
                "resources": {
                    "data": [
                        {
                            "type": "items",
                            "id": itemId
                        }
                    ]
                }
            }
        }
    }
}



module.exports = 
{ 
    delay,
    getWorkitemStatus, 
    cancelWorkitem, 
    exportExcel,
    importExcel,
    createBodyOfPublishCloudModel,
    workitemList 
};
