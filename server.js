const express = require('express');
const expressVue = require('express-vue');
const schedule = require('node-schedule');
const fetch = require('isomorphic-fetch');
const path = require('path');

const controller = require('./controller');
const app = express();

const PORT = 3000;
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

app.get('/', (req, res) => {
  const data_response = {};
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

schedule.scheduleJob('00 26 * * * *', async() => {
  fetch(API_ENDPOINT)
    .then(res => res.json())
    .then(async({ members }) => {
      await updateMembers(members);
    });
  console.log('done!');
})

const getFactor = clan_chests => {
  if(clan_chests < 3) return 40;
  if(clan_chests < 7) return 30;
  if(clan_chests < 15) return 20;
  if(clan_chests < 50) return 15;
  return 10;
};

schedule.scheduleJob('50 * * * * *', () => {
  fetch(API_ENDPOINT)
    .then(res => res.json())
    .then(async({ members }) => {
      await updateMembers(members);
      // YOU MUST GUARANTEE THAT ALL MEMBERS SHOWN ARE CURRENTLY ON DB
      const active_members = await Promise.all(members.map(async(member) => {
        const db_member = await controller.getMember(member.name);
        return {
          name: member.name,
          clan_chest_crowns: member.clanChestCrowns,
          elo: db_member.elo,
          factor: getFactor(db_member.n_clan_chests),
          up_factor: Math.min(5, UP_CONSTANT * member.trophies / 2000),
          down_factor: Math.min(5, DOWN_CONSTANT * (db_member.donations / 4000 + member.donations / 250))
        };
      }))
      active_members.forEach(async(member, i) => {
        let expected_values_sum = 0;
        let real_values_sum = 0;
        active_members.forEach((other_member, j) => {
          if(i === j) return;
          const ra = member.elo;
          const rb = other_member.elo;
          const expected = 1 / (1+(Math.pow(10, (rb-ra)/400)));
          if(member.clan_chest_crowns > other_member.clan_chest_crowns) real_values_sum += 1;
          if(member.clan_chest_crowns === other_member.clan_chest_crowns) real_values_sum += 0.5;
          expected_values_sum += expected;
        })
        const final_value = real_values_sum - expected_values_sum;
        let factor = member.factor;
        if(final_value < 0) factor -= member.down_factor;
        else factor += member.up_factor;
        const new_elo = member.elo + (factor * final_value);
        await controller.updateElo(member.name, parseInt(new_elo));
      })
    })
})
