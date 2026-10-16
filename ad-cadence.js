/* Count newly completed questions, never ads, backtracking or list browsing. */
(function(root){
  class AdCadence {
    constructor(saved = {}) {
      this.count = Number.isInteger(saved.count) && saved.count >= 0 && saved.count < 4 ? saved.count : 0;
      this.interval = saved.interval === 4 ? 4 : 3;
      this.highest = Number.isInteger(saved.highest) ? saved.highest : -1;
    }
    newDeck(){ this.highest = -1; }
    complete(index){
      if(index <= this.highest) return false;
      this.highest = index;
      if(++this.count < this.interval) return false;
      this.count = 0;
      this.interval = this.interval === 3 ? 4 : 3;
      return true;
    }
  }
  root.AdCadence = AdCadence;
  if(typeof module !== 'undefined') module.exports = AdCadence;
})(typeof window !== 'undefined' ? window : globalThis);
