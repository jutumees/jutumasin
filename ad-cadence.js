/* Count newly completed questions, never ads, backtracking or list browsing. */
(function(root){
  class AdCadence {
    constructor(saved = {}) {
      this.count = Number.isInteger(saved.count) && saved.count >= 0 && saved.count < 6 ? saved.count : 0;
      this.interval = saved.interval === 4 ? 4 : 3;
      this.activeMs = Number.isFinite(saved.activeMs) && saved.activeMs >= 0 ? saved.activeMs : 0;
      this.highest = Number.isInteger(saved.highest) ? saved.highest : -1;
    }
    addPlayTime(ms){ if(Number.isFinite(ms) && ms > 0) this.activeMs += ms; }
    newDeck(){ this.highest = -1; }
    complete(index){
      if(index <= this.highest) return false;
      this.highest = index;
      const calm = this.activeMs >= 5 * 60 * 1000;
      this.count = this.count + 1;
      if(this.count < (calm ? this.interval + 2 : this.interval)) return false;
      this.count = 0;
      this.interval = this.interval === 3 ? 4 : 3;
      return true;
    }
  }
  root.AdCadence = AdCadence;
  if(typeof module !== 'undefined') module.exports = AdCadence;
})(typeof window !== 'undefined' ? window : globalThis);
