const Member = require('./models/members');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/canalclan');
mongoose.Promise = global.Promise;

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'Connection Error!'));
db.once('open', function(){});

module.exports.createMember = (name, trophies, donations) => {
  return (new Member({
    name,
    donations,
    trophies,
    last_donation: donations,
    created_at: Date.now(),
  })).save();
};

module.exports.getMembers = () => Member.find({ active: true })

module.exports.getMember = name => Member.findOne({ name })

module.exports.fireMember = name =>
  Member.update(
    { name },
    { $set: { active: false } }
  );

module.exports.updateElo = async(name, new_elo) => {
  const member = await Member.findOne({ name });
  if(!member) return null;
  return Member.update(
    { name },
    { $set: { last_elo: member.elo, elo: new_elo },
      $inc: { n_clan_chests: 1 },
    }
  )
}

module.exports.increaseDonations = (name, donations) =>
  Member.update(
    { name },
    { $inc:
      { donations: donations < 0 ? 0 : donations,
        last_donation: donations,
      }
    }
  )

module.exports.updateTrophies = (name, trophies) =>
  Member.update(
    { name },
    { $set: { trophies } }
  );
