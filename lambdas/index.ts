import { Handler } from "aws-cdk-lib/aws-lambda";
 import * as amqp from 'amqplib';
import * as fs from 'fs';
import { APIGatewayEvent } from 'aws-lambda';
import * as parser from 'lambda-multipart-parser'
import { getSignedUrl, s3Upload } from "./s3utils";
import { RMQMsg } from "./dto";

export const logger = console;

const createResponse = (code:number, body: any) => {
    return {
        statusCode: code,
        headers: { 'Content-Type': 'application/json'},
        isBase64Encoded: false,
        body: JSON.stringify(body),
    };
}
export const handler: Handler = async (event:APIGatewayEvent) => {

    const { resource, httpMethod, pathParameters, body } = event;
    logger.info(`Receiving ${httpMethod} request, on resource ${resource}, path parameter is ${pathParameters}`);

    const contentType = event.headers['Content-Type'] || event.headers['content-type'];

    const result = await parser.parse(event);
    const file = result.files[0];
    const token = result.token;
    const site_code = result.token.substring(0,4);
    const hardware_id = result.hardware_id;
    const location = result.location;
    logger.info(`The incoming token is ${token}, site code is ${site_code}, location is ${location}, hardware_id is ${hardware_id}`);
    logger.info(`The incoming file, name is ${file.filename}, content type is ${file.contentType}, encoding is ${file.encoding}`);

    switch (resource) {
        case '/sync/file-manager/upload':
        case '/sync': {

            try {

                const s3Params = {
                    Bucket: process.env.BUCKET_NAME,
                    Key: `${Date.now().toString()}-${file.filename}`,
                    Body: file.content,
                    ContentType: file.contentType,
                    ContentEncoding: file.encoding,
                    //ACL: 'public-read',
                }

                const s3Content:any = await s3Upload(s3Params)

                const signedUrl = await getSignedUrl(process.env.BUCKET_NAME!, s3Content['key']);

                logger.info("signed url is : ", signedUrl);

                let messageBody:RMQMsg = {
                    s3Url: signedUrl,
                    guestId: token,
                    token: token,
                    location: location,
                    hardwareId: hardware_id,
                    tags: [],
                }

                const sslOptions = {
                    ca: [fs.readFileSync("ca.cert.pem", {encoding: 'utf-8'})],
                    rejectUnauthorized: false, // Ignore self-signed certificate errors
                };

                const connection = await amqp.connect({
                    hostname: process.env.RABBITMQ_HOST,
                    port: +process.env.RABBITMQ_PORT!,
                    username: process.env.RABBITMQ_USER,
                    password: process.env.RABBITMQ_PASS,
                    protocol: 'amqps',
                    ...sslOptions,
                });
                // Create a channel
                const channel = await connection.createChannel();

                const exchange_name = 'event.exchange';
                const exchange_type = 'headers';
                const queue_name = '';
                const customArguments = {'eventType':'CLOUD_CAPTURE', 'siteCode': site_code, 'x-match': 'all'}
                const opts: amqp.Options.Publish = {
                    headers: customArguments,
                };
                //const opts = { 'siteCode': 'TEST', 'x-match': 'all', 'Publish': '' };

                await channel.assertExchange(exchange_name, exchange_type, {
                    durable: true,
                })
                // Declare the queue
                //await channel.assertQueue(queueName, { durable: false });
                //logger.info("message body is ", JSON.stringify(messageBody));
                //logger.info("message opts is ", JSON.stringify(opts));
                // Send a message to the queue
                channel.publish(exchange_name, queue_name, Buffer.from(JSON.stringify(messageBody)), opts);
                logger.info(`[x] Published message "${messageBody}" to <${exchange_name} : ${JSON.stringify(opts)}>`);
                // Close the channel and connection
                await channel.close();
                await connection.close();

                return createResponse(200, messageBody);

            } catch (error) {
                logger.error('Error:', error);
                return {
                    statusCode: 500,
                    body: JSON.stringify({ error: 'Internal Server Error' }),
                };
            }

        }

        default : {
            return createResponse(500, { result: 'Error: Resource was not found!'});
        }
    }



    
}

// const sendRes = (status:any, body:any) => {
//     var response = {
//         statusCode: status,
//         headers: {
//             "Content-Type": "text/html",
//         },
//         body: body,
//     };
//     return response;
// }
