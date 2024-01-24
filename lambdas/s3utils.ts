import { S3 } from "aws-sdk";
import { resolve } from "path";
import {getCredentials} from './sts';
import { logger } from './index';
export const s3Upload = async function (params:any) {
    let s3: S3
    //if (process.env.IS_OFFLINE) {
        s3 = new S3({
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
        })
    //}
    return new Promise((resolve) => {
        s3.upload(params, (err:any, data:any) => {
        if (err) {
            console.error(err)
            resolve(err)
        } else {
            resolve(data)
        }
        })
    })
}

export const getSignedUrl = async function (bucket: string, key:string) {
    logger.info("getting signed url...")
    // const credentials = await getCredentials({
    //     sourceAccount: process.env.SOURCE_ACCOUNT!,
    //     remoteRoleName: process.env.REMOTEROLE_NAME!,
    // });
    // let s3: S3
    // s3 = new S3(credentials)


    // console.log("access id is ", credentials.accessKeyId);
    // console.log("access secret is ", credentials.secretAccessKey);

    let s3: S3;
    s3 = new S3({
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
    })
    // return s3.getSignedUrlPromise('getObject', {
    //     Bucket: bucket,
    //     Key: key,
    //     ContentType: 'image/jpg',
    //     Expires: 3600
    // })

    return s3.getSignedUrl('getObject', {
        Bucket: bucket,
        Key: key,
        Expires: 3600,
    })
}