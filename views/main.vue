<template> 
  <div>
    <h1> Canalclan ELO </h1>
    <table border="1">
      <thead>
        <td>Jugador</td>
        <td>Trofeos</td>
        <td>Donaciones totales</td>
        <td>Donaciones parciales</td>
        <td>Nuevo Ingreso</td>
        <td>ELO</td>
      </thead>
      <tr v-for="member of members">
        <td>{{member.name}}</td>
        <td>{{member.trophies}}</td>
        <td>{{member.donations}}</td>
        <td>{{member.last_donation}}</td>
        <td>{{member.is_new ? 'SI':'NO' }}</td>
        <td>{{member.elo}} {{ member.elo_change }}</td>
    </table>
  </div>
</template>

<script>
export default {
  data(){}
}
</script>
