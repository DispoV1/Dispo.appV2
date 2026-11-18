const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const context={window:{},Date};vm.createContext(context);vm.runInContext(fs.readFileSync('dist/availability.js','utf8'),context);
const dates=context.window.AvailabilityDates;
const posts=[{id:'past',date:'2026-11-08',series:'mixed'},{id:'today',date:'2026-11-09',series:'mixed'},{id:'future',date:'2026-11-10'},{id:'closed',date:'2026-11-10',closed:true},{id:'past-closed',date:'2026-11-08',closed:true}];
test('mixed series split by date; closed future slots do not count as active',()=>{
 const p=dates.partition(posts,'2026-11-09');assert.equal(p.active.map(p=>p.id).join(','),'today,future');assert.equal(p.expired.map(p=>p.id).join(','),'past,past-closed');assert.equal(p.closed[0].id,'closed');assert.equal(posts[0].series,'mixed');
});
test('today stays current; next day moves it into archive without mutation',()=>{
 assert.equal(dates.isExpired(posts[1],'2026-11-09'),false);assert.equal(dates.isExpired(posts[1],'2026-11-10'),true);
 assert.equal(dates.partition(posts,'2026-11-11').active.length,0);assert.equal(dates.partition(posts,'2026-11-11').expired.length,5);assert.equal(posts[0].closed,undefined);
});
test('local calendar handles year and leap-day transitions',()=>{
 assert.equal(dates.relativeDate('tomorrow',new Date(2026,11,31,23,59)),'2027-01-01');assert.equal(dates.relativeDate('tomorrow',new Date(2028,1,28,23,59)),'2028-02-29');assert.equal(dates.today(new Date(2026,10,9,23,59)),'2026-11-09');
});
const src=fs.readFileSync('dist/app.js','utf8');
const ui={...context,AvailabilityDates:{...dates,partition:p=>dates.partition(p,'2026-11-09')},activeAccount:'employee',state:{posts:[],city:'Test',lang:'fr'},tr:(f,e)=>ui.state.lang==='en'?e:f,button:(label,action,classes)=>`<button class="${classes}" data-action="${action}">${label}</button>`,esc:String,category:String};
vm.createContext(ui);vm.runInContext(src.slice(src.indexOf('function employeeAvailabilityPage()'),src.indexOf('function postsPage()')),ui);
function html(posts,lang='fr'){ui.state.posts=posts.map(p=>({...p,role:'employee',sector:'Commerce',start:'12:00',end:'16:00',rate:24}));ui.state.lang=lang;return ui.employeeAvailabilityPage()}
test('CTA reflects only current open entries and archive is separate',()=>{
 assert.match(html([]),/>\+ Offrir mes disponibilités</);assert.match(html([posts[0],posts[3]]),/>\+ Offrir mes disponibilités</);
 const mixed=html(posts);assert.match(mixed,/>\+ Offrir PLUS de disponibilités</);assert.match(mixed,/Mes disponibilités expirées \(2\)/);assert.match(mixed,/Mes disponibilités clôturées \(1\)/);
 const archive=mixed.slice(mixed.indexOf('Mes disponibilités expirées'));assert.ok(!archive.includes('data-action="close:'));assert.match(html([posts[1]],'en'),/Offer MORE availability/);
 ui.activeAccount=null;assert.match(html(posts),/>\+ Offrir mes disponibilités</);ui.activeAccount='employee';
});
test('automatic refresh waits until forms are closed',()=>{
 let day='2026-11-09',renders=0,overlay=false;
 const timer={AvailabilityDates:{today:()=>day},state:{role:'employee',tab:'posts',modal:null},document:{querySelector:()=>overlay,addEventListener(){}},window:{addEventListener(){}},setInterval(){},render(){renders++}};
 vm.createContext(timer);vm.runInContext(src.slice(src.indexOf('let availabilityRenderedDate=')),timer);
 day='2026-11-10';overlay=true;timer.refreshAvailabilityDate();assert.equal(renders,0);overlay=false;timer.refreshAvailabilityDate();assert.equal(renders,1);timer.refreshAvailabilityDate();assert.equal(renders,1);
});
