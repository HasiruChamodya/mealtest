const { writeAudit } = require("./audit");

const logAudit = async ({ actor_id, actor_email, module, action, entity, entity_id, detail, ip }) => {
  return writeAudit({
    action,
    entity,
    entity_id: entity_id ? String(entity_id) : null,
    details: { module, detail, ip },
    actor_user_id: actor_id,
    actor_user_name: actor_email,
    severity: "info",
    success: true,
  });
};

module.exports = { logAudit };
