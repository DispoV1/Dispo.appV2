/* Calendar-day expiry: today remains current until local midnight. */
(function(){
  const today=(now=new Date())=>`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const isExpired=(post,day=today())=>Boolean(post.date&&post.date<day);
  function partition(posts,day=today()){
    const result={active:[],closed:[],expired:[]};
    for(const post of posts)result[isExpired(post,day)?'expired':post.closed?'closed':'active'].push(post);
    return result;
  }
  function relativeDate(day,now=new Date()){
    const date=new Date(now);if(day==='tomorrow')date.setDate(date.getDate()+1);return today(date);
  }
  window.AvailabilityDates={today,isExpired,partition,relativeDate};
})();
