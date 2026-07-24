/**
 * Archive-Transporter
 * Phase 4: imageParams is no longer required — text-only notifications are valid.
 */

import * as archive   from '../Archive/archive.js';
import * as announcer from '../Announcer/announcer.js';
import { createLogger } from '../../core/pipelineLogger.js';

const logger = createLogger('archive-transporter');

export async function fetch(notificationKey, client) {
  if (!notificationKey) {
    logger.error('TRANSPORTER_MISSING_KEY: notificationKey is required');
    return;
  }

  logger.info('fetching record', { notificationKey });

  let record;
  try {
    const result = await archive.get(notificationKey);
    if (result.error) {
      logger.error(`Archive.get failed: ${result.error}: ${result.message}`, { notificationKey });
      return;
    }
    record = result.record;
  } catch (err) {
    logger.error(`Archive.get threw: ${err.message}`, { notificationKey });
    return;
  }

  if (!record) {
    logger.error('TRANSPORTER_RECORD_MISSING: no Archive record', { notificationKey });
    return;
  }
  if (record.deadLetter) {
    logger.warn('record is dead-lettered — skipping delivery handoff', {
      notificationKey,
      reason: record.deadLetterReason,
    });
    return;
  }
  if (!record.payload) {
    logger.error('TRANSPORTER_PAYLOAD_MISSING: record has no payload', { notificationKey });
    return;
  }

  // Phase 4: imageParams is optional — Announcer's _renderCard handles its absence gracefully.
  // A notification with only payload.message is a valid text-only delivery.
  if (!record.payload.imageParams && !record.payload.message) {
    logger.error('TRANSPORTER_EMPTY_PAYLOAD: payload has neither imageParams nor message', { notificationKey });
    return;
  }

  if (!record.payload.imageParams) {
    logger.info('text-only notification — no card will be rendered', { notificationKey });
  }

  logger.info('handing off to Announcer', { notificationKey });
  try {
    await announcer.deliver(record, client);
  } catch (err) {
    logger.error(`Announcer.deliver threw: ${err.message}`, { notificationKey });
  }
}
