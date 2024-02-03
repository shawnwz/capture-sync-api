export type RMQMsg = {
    s3Url: string;
    guestId:string;
    token: string;
    location: string;
    hardwareId: string;
    tags: string[];
}
