import { Handler } from "aws-cdk-lib/aws-lambda";
 import * as amqp from 'amqplib';
import * as fs from 'fs';
import { APIGatewayEvent } from 'aws-lambda';
import * as parser from 'lambda-multipart-parser'
import { getSignedUrl, s3Upload } from "./s3utils";
import { RMQMsg } from "./dto";

export const logger = console;
export const handler: Handler = async (event:APIGatewayEvent) => {

    const { resource, httpMethod, pathParameters, body } = event;
    logger.info(`Receiving ${httpMethod} request, on resource ${resource}, path parameter is ${pathParameters}`);

    try {
        
        
        const contentType = event.headers['Content-Type'] || event.headers['content-type'];

        const result = await parser.parse(event);
        const file = result.files[0];
        const token = result.token;
        const site_code = result.token.substring(0,4);
        const hardware_id = result.hardware_id;
        const location = result.location;
        logger.info(`The incoming token is ${token}, site code is ${site_code}, location is ${location}, hardware_id is ${hardware_id}`);
        logger.info(`The incoming file, name is ${file.filename}, content type is ${file.contentType}, encoding is ${file.encoding}`);

        //const queueName = 'sync_api_'.concat(site_code).concat("_queue");

        //console.log("queue name is: ", queueName);


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
            s3_url: signedUrl,
            guest_id: token,
            token: token,
            location: location,
            hardware_id: hardware_id
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
        logger.info("message body is ", JSON.stringify(messageBody));
        // Send a message to the queue
        await channel.publish(exchange_name, queue_name, Buffer.from(JSON.stringify(messageBody)), opts);
    
        // Close the channel and connection
        await channel.close();
        await connection.close();
    
        return sendRes(200, JSON.stringify(messageBody));

    } catch (error) {
        logger.error('Error:', error);
        return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Internal Server Error' }),
        };
    }

    
}

const sendRes = (status:any, body:any) => {
    var response = {
        statusCode: status,
        headers: {
            "Content-Type": "text/html",
        },
        body: body,
    };
    return response;
}