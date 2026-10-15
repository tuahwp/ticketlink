# ADR 0018: Arrival ETA Timezone Alignment & Remote Evidence Ingestion

## Status
Accepted

## Context
During system integration testing with external partner IT Service (ITS) systems, two issues emerged:

1. **8-Hour Arrival ETA Timezone Discrepancy**:
   - Partner ITS sent valid UTC timestamps (`2026-10-16T02:00:00.000Z`), accurately reflecting 10:00 AM Malaysia Time (UTC+8).
   - In Ticket Workspace, the `<input type="datetime-local">` was initialized with `.toISOString().slice(0, 16)`, which output the raw UTC string without offsetting for the browser's timezone.
   - This caused the Arrival ETA input to render `02:00 AM` instead of `10:00 AM`, leading to user confusion and inadvertent 8-hour shift regressions if the form was resubmitted.
2. **Temporary Pre-Signed Evidence URL Expiration**:
   - External partner ITS systems send completion evidence and signed service reports via `POST /api/v1/partner/tickets/[id]/evidence` and `POST /resolve` using JSON payloads containing temporary pre-signed S3 links (`fileUrl`).
   - TicketLink previously stored the remote `fileUrl` string verbatim without downloading the underlying file.
   - When temporary links expired (typically after 15–60 minutes), subsequent access by technicians, clients, or auditors resulted in HTTP 403 Forbidden errors.
3. **Coolify Storage Architecture Clarification**:
   - Required verification of whether uploads were hosted on a separate container or directly mounted.

## Decision

1. **Standardized Timezone Offset Conversion (`toLocalInputString`)**:
   - Standardized `TicketWorkspace.tsx` to format `ticket.eta` using `toLocalInputString(ticket.eta)`:
     ```ts
     const localDate = new Date(dateObj.getTime() - dateObj.getTimezoneOffset() * 60000);
     return localDate.toISOString().slice(0, 16);
     ```
   - Added reactive synchronization (`useEffect`) so that inbound ETA updates triggered via partner API or background sync immediately reflect on the Arrival ETA field in the operator's local time (10:00 AM MYT).
   - Submissions parse local inputs back to standard UTC before persisting to PostgreSQL.

2. **Automated Server-Side Evidence Ingestion (`saveRemoteUrlToFile`)**:
   - Enhanced `src/lib/storage.ts` with `saveRemoteUrlToFile(remoteUrl, fallbackName)`:
     - Automatically streams remote files from `fileUrl` (supporting temporary presigned URLs with 15+ minutes validity).
     - Writes the file directly to `/app/public/uploads` inside the persistent storage volume.
     - Detects Content-Type, computes byte size, and generates a permanent local URL (`/api/uploads/${fileName}`).
   - Updated both `POST /evidence` and `POST /resolve` to automatically archive remote files upon receipt, with graceful fallback to the original URL if external network connectivity fails.

3. **Confirmation of Coolify Storage Model**:
   - Documented that TicketLink utilizes a **Coolify Persistent Volume mount** directly at `/app/public/uploads` within the Next.js container (not an external container), guarded by `start.sh` entrypoint permissions for `nextjs` (UID 1001) and served via `/api/uploads/[...filepath]`.

## Consequences

- **Positive**:
  - Eliminates the 8-hour timezone display discrepancy across all views; operators and partner systems have 100% time parity.
  - Partner systems can safely utilize short-lived, secure presigned URLs without exposing permanent S3 buckets, knowing TicketLink immediately ingests and permanently archives all evidence and signed service slips.
  - Zero broken links or expired signatures for historical service reports.
- **Negative / Considerations**:
  - The TicketLink container must have outbound Internet access to fetch remote URLs submitted by partner APIs.
