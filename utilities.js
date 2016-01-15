function mangleName(n){
  return "__" + n.replace(/[\-./.]/g, '_');
}

function quote(item){
  return '"' + item + '"';
}

module.exports = {
  mangleName: mangleName,
  quote: quote
};