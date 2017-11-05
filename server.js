const express = require('express');
const expressVue = require('express-vue');
const schedule = require('node-schedule');
const fetch = require('isomorphic-fetch');
const path = require('path');

const controller = require('./controller');
const app = express();

const PORT = process.env.PORT || 3000;
const CLAN_ID = '8YY0JYG8';
const API_ENDPOINT = `http://api.cr-api.com/clan/${CLAN_ID}`;

const DOWN_CONSTANT = 2.5;
const UP_CONSTANT = 2.5;

const vueOptions = {
  rootPath: path.join(__dirname, './views'),
  layout: {
    start: '<div id="app">',
    end: '</div>'
  }
};

const expressVueMiddleware = expressVue.init(vueOptions);
app.use(expressVueMiddleware);

app.get('/', async(req, res) => {
  const members = await controller.getMembers();
  const data_response = {
    members: members.map(member => {
      const elo_change = member.elo - member.last_elo;
      if(elo_change < 0)
        member.elo_change = elo_change.toString();
      else
        member.elo_change = '+'+(elo_change.toString());
      member.is_new = isNew(member);
      return member;
    }).sort((a,b) => b.elo - a.elo),
  };
  res.renderVue('main', data_response, { head: { title: 'ELO Canalclan' } } );
})

app.listen(PORT, () => {
  console.log('Server is on');
})

const updateMembers = async(current_members) => {
  const active_members = await current_members.reduce(async(acc, member) => {
    const db_member = await controller.getMember(member.name);
    if(db_member){
      const new_donations = member.donations - db_member.last_donation;
      await controller.increaseDonations(db_member.name, new_donations);
      await controller.updateTrophies(db_member.name, member.trophies);
    }
    else{
      await controller.createMember(member.name, member.trophies, member.donations)
    }
    return (await acc).add(member.name);
  }, new Set);
  
  const db_members = await controller.getMembers();
  return db_members.map(db_member => {
    if(!active_members.has(db_member.name)){
      return controller.fireMember(db_member.name);
    }
    return Promise.resolve(null);
  })
};

schedule.scheduleJob('0 0 * * * *', async() => {
  fetch(API_ENDPOINT)
    .then(res => res.json())
    .then(async({ members }) => {
      await updateMembers(members);
    });
  console.log('members were updated!');
})

const getFactor = clan_chests => {
  if(clan_chests < 3) return 40;
  if(clan_chests < 7) return 30;
  if(clan_chests < 15) return 20;
  if(clan_chests < 50) return 15;
  return 10;
};

const isNew = member => {
  if(!member.created_at) return false; // DA PARCHE
  const now = new Date();
  const friday_8am = new Date(
    (new Date().setHours(8,0,0))-
    (24*60*60*1000*Math.abs(((now.getDay()+6)%7) - 5))
  );
  return member.created_at >= friday_8am.getTime();
};

schedule.scheduleJob('20 6 * * * *', () => {
  fetch(API_ENDPOINT)
    .then(res => res.json())
    .then(async({ members }) => {
      await updateMembers(members);
      const active_members = (await Promise.all(members.map(async(member) => {
        const db_member = await controller.getMember(member.name);
        return {
          is_new: isNew(db_member),
          name: member.name,
          clan_chest_crowns: member.clanChestCrowns,
          elo: db_member.elo,
          factor: getFactor(db_member.n_clan_chests),
          up_factor: Math.min(5, UP_CONSTANT * member.trophies / 2000),
          down_factor: Math.min(5, DOWN_CONSTANT * (db_member.donations / 4000 + member.donations / 250))
        };
      }))).filter(member => !member.is_new);
      active_members.forEach(async(member, i) => {
        if(isNew(member)) return;
        const elo_values = active_members.reduce((acc, other_member, j) => {
          if(i === j || isNew(other_member)) return acc;
          const ra = member.elo;
          const rb = other_member.elo;
          const expected = 1 / (1+(Math.pow(10, (rb-ra)/400)));
          if(member.clan_chest_crowns >= other_member.clan_chest_crowns){
            return {
              sum_received_values: acc.sum_received_values + 
                (member.clan_chest_crowns === other_member.clan_chest_crowns ? 0.5 : 1),
              sum_expected_values: acc.sum_expected_values + expected,
            }
          }
          return {
            sum_received_values: acc.sum_received_values,
            sum_expected_values: acc.sum_expected_values + expected,
          };
        }, { sum_expected_values: 0, sum_received_values: 0 });
        const final_value = elo_values.sum_received_values - elo_values.sum_expected_values;
        const factor = final_value < 0 ?
          member.factor - member.down_factor :
          member.factor + member.up_factor;
        await controller
          .updateElo(
            member.name,
            parseInt(member.elo + (factor * final_value))
          );
      })
      console.log('elo was assigned');
    })
})
