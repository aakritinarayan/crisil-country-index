import "server-only";
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";

/* All Azure Blob Storage access (TECH_SPEC §7). One private container (default
 * `index-uploads`):
 *   snapshots/v{version}/{filename}   accepted uploads — kept indefinitely
 *   rejected/{id}/{filename}          failed validation — a lifecycle rule expires these
 * Blobs are only touched on the admin path (upload, download), never by a public page. */

export const storageConfigured = () => !!process.env.AZURE_STORAGE_CONNECTION_STRING;

/** Credential acquisition, in one place: a connection string today. Moving onto Azure
 *  infrastructure means switching this to DefaultAzureCredential + Managed Identity;
 *  nothing else changes. */
function service(): BlobServiceClient {
  const cs = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!cs) throw new Error("AZURE_STORAGE_CONNECTION_STRING is not set.");
  return BlobServiceClient.fromConnectionString(cs);
}

const g = globalThis as { _container?: ContainerClient };
function container(): ContainerClient {
  return (g._container ??= service().getContainerClient(process.env.AZURE_STORAGE_CONTAINER || "index-uploads"));
}

export const safeName = (n: string) => (n.replace(/[^\w.\- ()]+/g, "_").replace(/^\.+/, "").slice(0, 160) || "workbook.xlsx");
export const acceptedPath = (version: number, filename: string) => `snapshots/v${version}/${safeName(filename)}`;
export const rejectedPath = (id: string, filename: string) => `rejected/${id}/${safeName(filename)}`;

export async function putBlob(path: string, data: Buffer, contentType: string) {
  // never overwrite: a version's source file is written once
  await container().getBlockBlobClient(path).uploadData(data, {
    blobHTTPHeaders: { blobContentType: contentType },
    conditions: { ifNoneMatch: "*" },
  });
}

/** The blob's bytes, or null if it no longer exists. */
export async function getBlob(path: string): Promise<Buffer | null> {
  try {
    return await container().getBlockBlobClient(path).downloadToBuffer();
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode === 404) return null;
    throw e;
  }
}
