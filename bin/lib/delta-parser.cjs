'use strict';

const { loadSchema } = require('./utils.cjs');

function validateDelta(agentName, delta) {
  const schema = loadSchema();
  if (!schema) return { valid: false, errors: ['Cannot load bonfire-v1.json schema'] };

  const agentSchema = schema.delta_schemas[agentName];
  if (!agentSchema) return { valid: false, errors: [`Unknown agent: ${agentName}`] };

  const errors = [];

  for (const field of agentSchema.required_fields) {
    if (delta[field] === undefined || delta[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  const constraints = agentSchema.constraints || {};

  for (const [key, minLen] of Object.entries(constraints)) {
    if (key.endsWith('_min_length')) {
      const fieldName = key.replace('_min_length', '');
      const arr = delta[fieldName];
      if (!Array.isArray(arr) || arr.length < minLen) {
        errors.push(`${fieldName} must have at least ${minLen} item(s), got ${Array.isArray(arr) ? arr.length : 0}`);
      }
    }
  }

  if (constraints.verdict_enum && delta.verdict !== undefined) {
    if (!constraints.verdict_enum.includes(delta.verdict)) {
      errors.push(`verdict must be one of [${constraints.verdict_enum.join(', ')}], got "${delta.verdict}"`);
    }
  }

  if (constraints.conflict_type_required_when_rejected && delta.verdict === 'rejected') {
    if (!delta.conflict_type) {
      errors.push('conflict_type is required when verdict is "rejected"');
    }
  }

  if (constraints.conflict_type_from_reentry_routes && delta.conflict_type) {
    const validTypes = Object.keys(schema.reentry_routes);
    if (!validTypes.includes(delta.conflict_type)) {
      errors.push(`conflict_type "${delta.conflict_type}" not in reentry routes [${validTypes.join(', ')}]`);
    }
  }

  if (constraints.condition_item_shape && delta.conditions !== undefined) {
    const shape = constraints.condition_item_shape;
    if (!Array.isArray(delta.conditions)) {
      errors.push('conditions must be an array when present');
    } else {
      for (let i = 0; i < delta.conditions.length; i++) {
        const item = delta.conditions[i];
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          errors.push(`conditions[${i}] must be an object`);
          continue;
        }
        for (const required of (shape.required_fields || [])) {
          if (item[required] === undefined || item[required] === null) {
            errors.push(`conditions[${i}] missing required field: ${required}`);
          }
        }
        if (shape.target_stage_enum && item.target_stage !== undefined) {
          if (!shape.target_stage_enum.includes(item.target_stage)) {
            errors.push(
              `conditions[${i}].target_stage "${item.target_stage}" ` +
              `not in [${shape.target_stage_enum.join(', ')}]`
            );
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateDelta };
