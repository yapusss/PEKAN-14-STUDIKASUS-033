const { BlobServiceClient } = require("@azure/storage-blob");
require("dotenv").config();

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;

if (
  !connectionString ||
  connectionString.includes("your_azure_storage_connection_string_here")
) {
  console.warn(
    "WARNING: Azure Storage Connection String is not set or has placeholder value.",
  );
}

const blobServiceClient = BlobServiceClient.fromConnectionString(
  connectionString || "UseDevelopmentStorage=true",
);
const containerClient = blobServiceClient.getContainerClient(
  "container-studikasus-033",
);

module.exports = containerClient;
