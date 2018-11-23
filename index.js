// dependencies
const AWS = require('aws-sdk');
const util = require('util');
const async = require('async');
const imagemin = require('imagemin');
const imageminMozjpeg = require('imagemin-mozjpeg');

// get reference to S3 client
const s3 = new AWS.S3();

exports.handler = function(event, context, callback) {

    // Read options from the event.
    const srcBucket = event.Records[0].s3.bucket.name;

    // Object key may have spaces or unicode non-ASCII characters.
    const srcKey    =    decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
    const dstBucket = srcBucket + "-compressed";
    const dstKey    = srcKey;

    // Sanity check: validate that source and destination are different buckets.
    if (srcBucket == dstBucket) {
        callback("Source and destination buckets are the same.");
        return;
    }

    // Infer the image type.
    const typeMatch = srcKey.match(/\.([^.]*)$/);
    if (!typeMatch) {
        callback("Could not determine the image type.");
        return;
    }
    const imageType = typeMatch[1];
    if (imageType != "jpg" && imageType != "png") {
        callback('Unsupported image type: ${imageType}');
        return;
    }

    async.waterfall([
      function download(next) {
        s3.getObject({
          Bucket: srcBucket,
          Key: srcKey
        }, next);
      },
      function minify(imageObject, next) {
        imagemin.buffer(imageObject.Body, {
            plugins: [
                imageminMozjpeg({quality: 70})
            ]
        }).then(files => {
          console.log(typeof files);
          next(null, files, imageObject.ContentType);
        }).catch(err => console.log('caught: ', err));
      },
      function upload(newImage, contentType, next) {
        s3.putObject({
          Bucket: dstBucket,
          Key: dstKey,
          Body: newImage,
          ContentType: contentType,
        }, next);
      },
    ], function(err) {
      if (err) {
        console.log(err);
      } else {
        console.log(`Image compressed and uploaded to ${dstBucket}`);
      }
      callback(null, "message");
    });
};
