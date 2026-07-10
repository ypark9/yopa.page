const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } = require("@aws-sdk/client-s3");
const { randomUUID } = require("crypto");

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const table = process.env.TABLE_NAME;
const bucket = process.env.BUCKET_NAME;
const maxBytes = 5 * 1024 * 1024;

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

function owner(event) {
  return event.requestContext.authorizer?.jwt?.claims?.sub;
}

function validId(value) {
  return /^[0-9a-f-]{36}$/.test(value || "");
}

function parseBody(event) {
  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "";
  if (Buffer.byteLength(raw, "utf8") > maxBytes) throw Object.assign(new Error("Scene exceeds 5 MB"), { statusCode: 413 });
  return JSON.parse(raw);
}

function validateScene(scene) {
  if (!scene || scene.type !== "yopadraw" || scene.version !== 1 || !Array.isArray(scene.elements) || typeof scene.files !== "object") {
    throw Object.assign(new Error("Invalid Yopa Draw scene"), { statusCode: 400 });
  }
}

exports.handler = async (event) => {
  try {
    const method = event.requestContext.http.method;
    const path = event.rawPath;

    if (method === "GET" && path === "/draw-api/config") {
      return response(200, {
        userPoolId: process.env.USER_POOL_ID,
        clientId: process.env.CLIENT_ID,
        cognitoDomain: process.env.COGNITO_DOMAIN,
      });
    }

    const ownerId = owner(event);
    if (!ownerId) return response(401, { message: "Authentication required" });

    if (method === "GET" && path === "/draw-api/documents") {
      const result = await db.send(new QueryCommand({
        TableName: table,
        KeyConditionExpression: "ownerId = :owner",
        ExpressionAttributeValues: { ":owner": ownerId },
        ProjectionExpression: "documentId, title, revision, createdAt, updatedAt",
      }));
      const documents = (result.Items || []).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return response(200, { documents });
    }

    if (method === "POST" && path === "/draw-api/documents") {
      const body = parseBody(event);
      validateScene(body.scene);
      const documentId = randomUUID();
      const now = new Date().toISOString();
      const title = String(body.title || "Untitled diagram").trim().slice(0, 120) || "Untitled diagram";
      const key = `${ownerId}/${documentId}/1-${randomUUID()}.json`;
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: JSON.stringify(body.scene), ContentType: "application/json", ServerSideEncryption: "AES256" }));
      await db.send(new PutCommand({ TableName: table, Item: { ownerId, documentId, title, revision: 1, createdAt: now, updatedAt: now, objectKey: key } }));
      return response(201, { id: documentId, revision: 1, updatedAt: now });
    }

    const documentId = event.pathParameters?.id;
    if (!validId(documentId)) return response(400, { message: "Invalid document ID" });
    const current = await db.send(new GetCommand({ TableName: table, Key: { ownerId, documentId } }));
    if (!current.Item) return response(404, { message: "Document not found" });

    if (method === "GET") {
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: current.Item.objectKey }));
      return response(200, { ...current.Item, ownerId: undefined, objectKey: undefined, scene: JSON.parse(await object.Body.transformToString()) });
    }

    if (method === "PUT") {
      const body = parseBody(event);
      validateScene(body.scene);
      const expected = Number(body.expectedRevision);
      if (expected !== current.Item.revision) return response(409, { message: "Document changed elsewhere", revision: current.Item.revision });
      const revision = expected + 1;
      const updatedAt = new Date().toISOString();
      const title = String(body.title || current.Item.title).trim().slice(0, 120) || "Untitled diagram";
      const nextKey = `${ownerId}/${documentId}/${revision}-${randomUUID()}.json`;
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: nextKey, Body: JSON.stringify(body.scene), ContentType: "application/json", ServerSideEncryption: "AES256" }));
      try {
        await db.send(new UpdateCommand({
          TableName: table,
          Key: { ownerId, documentId },
          UpdateExpression: "SET title = :title, revision = :next, updatedAt = :now, objectKey = :key",
          ConditionExpression: "revision = :expected",
          ExpressionAttributeValues: { ":title": title, ":next": revision, ":now": updatedAt, ":key": nextKey, ":expected": expected },
        }));
      } catch (error) {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: nextKey })).catch(() => undefined);
        throw error;
      }
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: current.Item.objectKey })).catch(() => undefined);
      return response(200, { id: documentId, revision, updatedAt });
    }

    if (method === "DELETE") {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: current.Item.objectKey }));
      await db.send(new DeleteCommand({ TableName: table, Key: { ownerId, documentId } }));
      return { statusCode: 204 };
    }

    return response(405, { message: "Method not allowed" });
  } catch (error) {
    if (error.code === "ConditionalCheckFailedException") return response(409, { message: "Document changed elsewhere" });
    if (error instanceof SyntaxError) return response(400, { message: "Invalid JSON" });
    console.error(error);
    return response(error.statusCode || 500, { message: error.statusCode ? error.message : "Internal server error" });
  }
};
