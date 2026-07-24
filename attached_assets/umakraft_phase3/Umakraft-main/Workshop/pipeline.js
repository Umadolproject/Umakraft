/**
 * Workshop Pipeline Wire
 */

import { fabricate } from './Fabricator/fabricator.js';
import { validate } from './Validator/Validator.js';
import { receive, pickup, listReady, getReleaseMetadata } from './Terminal/terminal.js';
import { createLogger } from '../core/pipelineLogger.js';
import { failureEnvelope, successEnvelope } from '../core/pipelineEnvelope.js';

const logger = createLogger('workshop-pipeline');

async function runStage(stageName, fn, ...args) {
  try {
    return await fn(...args);
  } catch (err) {
    logger.error(`unhandled error in stage ${stageName}: ${err.message}`, { stageName });
    return failureEnvelope(stageName, 'PIPELINE_STAGE_ERROR', err.message);
  }
}

export async function produce(compiledProduct) {
  const blueprintKey = compiledProduct?.blueprintKey ?? '(unknown)';
  logger.info('workshop pipeline start', { blueprintKey });

  const fabricatorResult = await runStage('Fabricator', fabricate, compiledProduct);
  if (fabricatorResult.failedAt) return fabricatorResult;
  if (!fabricatorResult.success) {
    logger.warn('Fabricator failed', { blueprintKey, error: fabricatorResult.error });
    return failureEnvelope('Fabricator', fabricatorResult.error, fabricatorResult.message, { blueprintKey });
  }

  const validatorResult = await runStage('Validator', validate, fabricatorResult);
  if (validatorResult.failedAt) return validatorResult;
  if (!validatorResult.success || !validatorResult.approved) {
    logger.warn('Validator rejected deliverable', { blueprintKey, error: validatorResult.error });
    return failureEnvelope('Validator', validatorResult.error, validatorResult.message, { blueprintKey });
  }

  const terminalResult = await runStage('Terminal', receive, validatorResult);
  if (terminalResult.failedAt) return terminalResult;
  if (!terminalResult.success) {
    logger.warn('Terminal intake failed', { blueprintKey, error: terminalResult.error });
    return failureEnvelope('Terminal', terminalResult.error, terminalResult.message, { blueprintKey });
  }

  logger.info('workshop pipeline complete', {
    terminalId: terminalResult.terminalId,
    blueprintKey,
  });

  return successEnvelope('WorkshopPipeline', {
    terminalId: terminalResult.terminalId,
    blueprintKey,
    receivedAt: terminalResult.receivedAt,
  }, { blueprintKey });
}

export async function claimDeliverable(terminalId) {
  return pickup(terminalId);
}

export async function listPending(filter) {
  return listReady(filter);
}

export async function getDeliverableMetadata(terminalId) {
  return getReleaseMetadata(terminalId);
}
