const mongoose = require('mongoose');

const membersSchema = new mongoose.Schema({
  name: { type: String },
  elo: { type: Number, default: 1000 },
  last_elo: { type: Number, default: 1000 },
  donations: { type: Number },
  active: { type: Boolean, default: true },
  last_donation: { type: Number },
  trophies: { type: Number },
  n_clan_chests: { type: Number, default: 0 },
});

module.exports = mongoose.model('Members', membersSchema);
