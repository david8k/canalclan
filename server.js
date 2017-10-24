const express = require('express');
const expressVue = require('express-vue');
const app = express();
const path = require('path');

const PORT = 3000;

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
