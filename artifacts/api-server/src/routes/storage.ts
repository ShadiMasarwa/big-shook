import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission, getObjectAclPolicy } from "../lib/objectAcl";
import {
  checkIsAdminOrManager,
  requireAdminOrManager,
  verifyCustomerToken,
} from "../lib/managerAuth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * Admin/manager only — anonymous callers cannot mint upload URLs into the
 * private bucket. The contentType is validated by RequestUploadUrlBody to
 * prevent HTML/script payloads from being staged in private storage.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  if (!(await requireAdminOrManager(req, res))) return;

  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private object entities from PRIVATE_OBJECT_DIR.
 * Access policy:
 *   1. Resolve the object file (404 if missing).
 *   2. Inspect the object's ACL policy.
 *      - visibility="public" → allow anyone (READ).
 *      - Otherwise: caller must be an admin/manager OR a signed-in customer
 *        for whom canAccessObjectEntity() returns true.
 *   3. Otherwise → 401/403.
 *
 * This closes the unauthenticated read of arbitrary private paths.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  // Collapse "exists but forbidden" and "does not exist" into a single 404
  // response for any caller who cannot read the object. This prevents
  // unauthenticated path enumeration / existence oracles on the private
  // bucket. Authenticated callers who still fail authz also get 404 for
  // the same reason (they have no business knowing the object exists).
  const sendNotFound = () => {
    res.status(404).json({ error: "Object not found" });
  };

  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    let objectFile;
    try {
      objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        sendNotFound();
        return;
      }
      throw err;
    }

    const aclPolicy = await getObjectAclPolicy(objectFile);
    const isPublic = aclPolicy?.visibility === "public";

    if (!isPublic) {
      // Admins/managers can always read.
      const isAdmin = await checkIsAdminOrManager(req);
      if (!isAdmin) {
        const authHeader = req.headers.authorization;
        const token = authHeader ? authHeader.replace("Bearer ", "") : null;
        const userId = token ? verifyCustomerToken(token) : null;

        if (userId === null) {
          sendNotFound();
          return;
        }

        const canAccess = await objectStorageService.canAccessObjectEntity({
          userId: String(userId),
          objectFile,
          requestedPermission: ObjectPermission.READ,
        });
        if (!canAccess) {
          sendNotFound();
          return;
        }
      }
    }

    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
