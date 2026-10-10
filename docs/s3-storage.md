# Storing files in S3

The tracker keeps attachments on disk (`UPLOADS_DIR`, `data/uploads` by default) unless `S3_BUCKET` is set; then they go to that S3 bucket. Use S3 wherever the disk doesn't last, such as Railway, which starts every deploy on a fresh disk. Local development needs nothing: without `S3_BUCKET` it works as before.

## Settings

Set these in the server's environment (Railway: the service's **Variables**; locally: a `.env`, which git ignores, made from `.env.example`). Keys never go in the repo, a ticket or a chat.

| Variable                | What                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `S3_BUCKET`             | The bucket's name. Set: files go to S3. Empty: files stay on disk.                             |
| `AWS_REGION`            | The bucket's region, such as `us-east-1`.                                                      |
| `AWS_ACCESS_KEY_ID`     | The key of the IAM user below. The AWS SDK reads it from the environment.                      |
| `AWS_SECRET_ACCESS_KEY` | Its secret.                                                                                    |
| `S3_ENDPOINT`           | Only for an S3-compatible store (MinIO, Cloudflare R2…): its URL. Leave it out for AWS itself. |

The server checks them at start and stops with a message when they are half set: `S3_BUCKET` without `AWS_REGION` or either key, `S3_ENDPOINT` without `S3_BUCKET`, a bucket name that isn't one (`s3://…`, capitals) or an endpoint that isn't an http(s) URL. Its start-up log says where files go: `Files in S3 bucket <name> (<region>)` or the folder.

## The bucket

1. Create a general purpose bucket in the region closest to the server (Railway's region).
2. Keep **Block all public access** on and **ACLs disabled** (both are the defaults). Nothing in the bucket is public: the browser never talks to S3. It asks the tracker, which checks access and streams the file from S3, with the same URLs (`/api/attachments/<id>/file`), cache headers and Range answers as from disk. So the bucket needs **no CORS** settings and no presigned URLs.
3. Default encryption (SSE-S3) is on for every new bucket; nothing to change.
4. Add a lifecycle rule for the whole bucket: **Delete expired object delete markers or incomplete multipart uploads → Delete incomplete multipart uploads after 1 day**. The server already aborts an upload that fails (too big, cut off, refused), but a server killed mid-upload can't, and S3 bills for parts it keeps.

## The IAM user

Create an IAM user for the tracker alone, with an access key and no console access, and give it this policy (replace `<bucket>`):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "TrackerFiles",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:AbortMultipartUpload",
        "s3:ListMultipartUploadParts"
      ],
      "Resource": "arn:aws:s3:::<bucket>/*"
    },
    {
      "Sid": "MissingFilesAnswer404",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::<bucket>"
    }
  ]
}
```

- `s3:PutObject` covers single uploads and every step of a multipart upload but its abort; `s3:GetObject` covers downloads, ranges and HEAD.
- The second statement is optional. Without `s3:ListBucket`, S3 answers 403 instead of 404 for a file that isn't there, so the tracker answers 500 instead of 404 for it (a file is missing only when it was never copied there, see Existing files).

## How files are kept

- Each file is the object `attachments/<id>.<extension>`, where `<id>` is the attachment's id. The database keeps `<id>.<extension>` (`storage_key`), the same as on disk; names people give their files never reach a key.
- Uploads stream to S3 as they arrive (`@aws-sdk/lib-storage`): a file up to 5 MB in one PUT, a bigger one in 5 MB parts, two at a time, so an upload holds about 10 MB of server memory whatever its size. Images are the exception: they are read whole (at most 15 MB) and compressed before they are stored, and only the compressed file goes to S3 (`docs/architecture.md`, PT-127). The limits per kind stay (images 15 MB, videos 100 MB, text 5 MB, PDFs 25 MB). A file that passes its limit or stops arriving aborts its multipart upload, so S3 keeps no parts and no object, and the database no row.
- A Range request reads just those bytes from S3 (a video seeking), and a dropped one closes its connection to S3. HEAD asks S3 for the size (`HeadObject`) without downloading.
- Deleting an attachment, ticket, comment or project deletes its rows, then its objects. When S3 refuses to delete an object, the delete has still happened (204) and the log names the object (`File <key> stays…`), for you to remove: `aws s3 rm s3://<bucket>/attachments/<key>`. No server removes an object its own database didn't delete: one that listed the bucket and removed what its database didn't name deleted the files of every other database on the bucket (PT-133 review).
- An upload's row goes in before its object, as a pending upload, and is finished once the object is whole. An upload cut off or a server stopped half way leaves a pending row naming the object, and the start-up clean-up of pending uploads over a day old removes both. A refused removal there is logged and the server starts anyway.
- Give each database its own bucket (or at least its own copy of the files). A copy of a database, such as a staging environment or a restored backup, removes what it records as deleted or pending, which may be files the original still uses.
- S3 errors are logged with their name, code, HTTP status and request id only (`s3Errors.ts`): S3's body for a wrong secret names the access key and the string it signed, and the SDK copies it onto its error (PT-133).

## S3-compatible stores

Set `S3_ENDPOINT` to the store's URL; the server then addresses buckets by path (`<endpoint>/<bucket>/<key>`), which MinIO, R2 and others accept. `AWS_REGION` is still needed (R2: `auto`). If the store refuses the checksums the AWS SDK adds, set `AWS_REQUEST_CHECKSUM_CALCULATION=WHEN_REQUIRED` and `AWS_RESPONSE_CHECKSUM_VALIDATION=WHEN_REQUIRED`.

## Checking a real bucket

The tests use a fake S3 and never reach AWS. To check the real bucket and keys:

```bash
cp .env.example .env   # once; fill in S3_BUCKET, AWS_REGION and the keys
npm run test:s3 -w @tracker/server
```

It reads `.env`, then writes, reads (whole and in ranges), measures and deletes a small file and an 11 MB one in parts, and checks that a failed upload leaves nothing. Every object it makes is `attachments/smoke-<uuid>.<ext>` and is deleted at the end. `npm run verify` skips it.

To run the whole server against a bucket locally: `npm run build`, then `node --env-file=.env apps/server/dist/main.js`. Use a bucket of its own, not the online tracker's (above).

## Existing files

Turning S3 on doesn't move files already on disk; until they are moved those attachments answer 404 (500 without `s3:ListBucket`). Move them with the data move, which moves a local tracker's files with its database to Railway in one command, compresses images as new uploads are and stores only the compressed or stripped copy (`data-move.js`, `docs/deploy-railway.md` step 7, PT-124). Don't copy the folder to the bucket yourself (`aws s3 sync data/uploads …`): that skips the move's compression and stripping, so images uploaded before PT-127 would go online as they came, with their metadata such as where a photo was taken. A tracker that stays local keeps its files on disk (`S3_BUCKET` empty).

Files a Railway deployment kept on its volume (`UPLOADS_DIR`) are different: they are already online and their keys stay the same, so copying them as they are is right. Set `S3_BUCKET`, `AWS_REGION` and the keys on the service and let it deploy, so nothing new lands on the volume; until the copy is done those attachments are missing (above). Then, on your Mac with the [Railway CLI](https://docs.railway.com/cli) linked to the service and the bucket's keys in the shell, download the folder (`<folder>` is its path inside the volume, which `railway volume browse /` shows) and copy it under `attachments/`, leaving out dot files (uploads cut off half way, which no row names), then delete the download. It uses `cp` because `sync` also needs `s3:ListBucket`:

```bash
railway volume files download <folder> ./uploads-from-volume
aws s3 cp --recursive --exclude '.*' ./uploads-from-volume s3://<bucket>/attachments/
rm -r ./uploads-from-volume
```
