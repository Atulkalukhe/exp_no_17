(function(){
"use strict";
var state={value:0,pulses:0,autoTimer:null,period:900,wavePaused:false,waveZoom:1,history:[],recorded:{0:0},sequenceTimer:null,practice:true};
var $=function(id){return document.getElementById(id)}, els={};
["pulseCount","decimalDisplay","binaryDisplay","nextDisplay","weightsDisplay","clockModeNote","tableBody","tableStatus","tableProgress","speedRange","speedLabel","autoToggle","pulseBtn","startBtn","pauseBtn","stepBtn","resetBtn","pulseDot","waveSvg","waveGrid","waveTraces","waveCursor","toast","practicePulse","practiceAnswer","practiceFeedback"].forEach(function(k){els[k]=$(k)});
var bitsOrder=["QD","QC","QB","QA"], rows={};
function bcd(v){return [Math.floor(v/8)%2,Math.floor(v/4)%2,Math.floor(v/2)%2,v%2]}
function display(){
 var bits=bcd(state.value), str=bits.join("");
 els.pulseCount.textContent=state.pulses;
 els.decimalDisplay.textContent=state.value;
 els.binaryDisplay.textContent=str;
 els.nextDisplay.textContent=bcd((state.value+1)%10).join("");
 els.weightsDisplay.textContent=bits[0]*8+" + "+bits[1]*4+" + "+bits[2]*2+" + "+bits[3]+" = "+state.value;
 els.clockModeNote.textContent=state.value===9?"Next edge rolls 9 → 0":"Falling-edge triggered";
 bitsOrder.forEach(function(name,i){
  var n=name.slice(1), unit=document.querySelector('[data-led="'+name+'"]');
  if(unit)unit.classList.toggle("on",!!bits[i]);
  var level=$("level"+name);if(level)level.textContent=bits[i]?"HIGH":"LOW";
  var wire=$(name.toLowerCase()+"Wire");if(wire)wire.classList.toggle("high",!!bits[i]);
 });
 document.querySelectorAll(".bb-leds i").forEach(function(el,i){el.classList.toggle("on",!!bits[i])});
 updateTable();drawWaves();
}
function toast(msg){els.toast.textContent=msg;els.toast.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(function(){els.toast.classList.remove("show")},2200)}
function pulse(){
 if(conflict())return;
 var old=state.value;
 state.value=(state.value+1)%10;state.pulses++;
 // Sampling table represents first complete 0–10 observation run.
 if(state.pulses<=10)rows[state.pulses]=state.value;
 state.history.push({clk:0,value:old});state.history.push({clk:1,value:old});state.history.push({clk:0,value:state.value});
 if(state.history.length>75)state.history=state.history.slice(-75);
 display();
 var dot=els.pulseDot;dot.classList.remove("pulsing");void dot.offsetWidth;dot.classList.add("pulsing");
 var cw=$("clockWire");cw.classList.add("high");setTimeout(function(){cw.classList.remove("high")},140);
}
function conflict(){var reset=$("resetR1").checked&&$("resetR2").checked,set=$("setS1").checked&&$("setS2").checked;
 if(reset&&set){$("controlMessage").textContent="Reset and preset pairs are both HIGH. This combination is unspecified; lower one pair to continue.";$("controlMessage").className="control-message warn";return true}return false}
function updateControls(){
 var r1=$("resetR1").checked,r2=$("resetR2").checked,s1=$("setS1").checked,s2=$("setS2").checked;
 if(r1&&r2&&s1&&s2){stopAuto();conflict();display();return}
 if(r1&&r2){state.value=0;stopAuto();$("controlMessage").textContent="R0(1) + R0(2) HIGH → asynchronous clear to 0000.";$("controlMessage").className="control-message good"}
 else if(s1&&s2){state.value=9;stopAuto();$("controlMessage").textContent="R9(1) + R9(2) HIGH → asynchronous preset to 1001.";$("controlMessage").className="control-message good"}
 else{$("controlMessage").textContent="Both inputs in a pair must be HIGH to activate the asynchronous function.";$("controlMessage").className="control-message"}
 display()
}
function updateTable(){
 var body=els.tableBody, html="";
 for(var i=0;i<=10;i++){
  var val=(i in rows)?rows[i]:null;
  var isCurrent=(state.pulses===i && val!==null);
  var cls=(val===null?"uncaptured ":"")+(isCurrent?"active-row ":"")+(i===10?"rollover-row":"");
  var bitset=val===null?["—","—","—","—"]:bcd(val);
  html+="<tr class='"+cls+"'><td>"+i+"</td><td>"+bitset[0]+"</td><td>"+bitset[1]+"</td><td>"+bitset[2]+"</td><td>"+bitset[3]+"</td><td>"+(val===null?"—":val)+"</td></tr>";
 }
 body.innerHTML=html;
 var cap=Object.keys(rows).length;
 $("tableProgress").textContent=cap+" / 11";
 if(state.pulses>=10){$("tableStatus").textContent="First decade cycle recorded"}
 else $("tableStatus").textContent=state.pulses===0?"Recording live":"Recording · pulse "+state.pulses;
}
function stopAuto(){if(state.autoTimer){clearInterval(state.autoTimer);state.autoTimer=null}els.startBtn.disabled=false;els.pauseBtn.disabled=true;els.autoToggle.checked=false}
function startAuto(){if(state.autoTimer)return;state.autoTimer=setInterval(pulse,state.period);els.startBtn.disabled=true;els.pauseBtn.disabled=false;els.autoToggle.checked=true}
function restartExperiment(){stopAuto();state.value=0;state.pulses=0;state.history=[];rows={0:0};$("resetR1").checked=false;$("resetR2").checked=false;$("setS1").checked=false;$("setS2").checked=false;display();toast("Experiment restarted at 0000.")}
function drawWaves(){
 var g=els.waveGrid,t=els.waveTraces;if(!g||!t)return;
 var data=state.history.slice(-Math.max(8,Math.floor(30/state.waveZoom)));
 var left=54,right=675, top=15, gap=39, usable=right-left;
 var gh="", labels=["CLK","QA","QB","QC","QD"];
 for(var i=0;i<5;i++){var y=top+i*gap;gh+='<line class="grid-line" x1="'+left+'" y1="'+(y+18)+'" x2="'+right+'" y2="'+(y+18)+'"/><text class="grid-label" x="8" y="'+(y+14)+'">'+labels[i]+'</text>'}
 var paths="";
 if(data.length<2)data=[{clk:0,value:state.value},{clk:1,value:state.value}];
 var sample=[];
 data.forEach(function(d){sample.push(d);});
 // Build one trace sample per stored phase. Output values change after the falling edge.
 for(var j=0;j<5;j++){
  var points=[];
  sample.forEach(function(d,k){var val=j===0?d.clk:bcd(d.value)[4-j];var x=left+(usable*(k/(sample.length-1)));var y=top+j*gap+(val?2:18);points.push([x,y])});
  var dpath="M"+points[0][0]+" "+points[0][1];
  for(var k=1;k<points.length;k++)dpath+=" H"+points[k][0]+" V"+points[k][1];
  paths+='<path class="trace trace-'+j+'" d="'+dpath+'"/>';
 }
 g.innerHTML=gh;t.innerHTML=paths;
 var cur=$("waveCursor");cur.setAttribute("x1",right);cur.setAttribute("x2",right);
}
function clearWaves(){state.history=[];drawWaves();toast("Timing trace cleared.")}
function setPeriod(){state.period=Number(els.speedRange.value);els.speedLabel.textContent=(state.period/1000).toFixed(2).replace(/0$/,"")+" s";if(state.autoTimer){stopAuto();startAuto()}}
function csvExport(){
 var lines=["Clock Pulses,QD,QC,QB,QA,Decimal Equivalent"];
 for(var i=0;i<=10;i++){var v=rows[i];var bb=v===undefined?["","","",""]:bcd(v);lines.push([i,bb[0],bb[1],bb[2],bb[3],v===undefined?"":v].join(","))}
 var blob=new Blob(["\ufeff"+lines.join("\r\n")],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="Observation-Table-17-1.csv";a.click();URL.revokeObjectURL(url);toast("CSV downloaded.")
}
function fillPractice(){els.practicePulse.innerHTML="";for(var i=0;i<=10;i++){var o=document.createElement("option");o.value=i;o.textContent="Pulse "+i;els.practicePulse.appendChild(o)}}
function checkPractice(){var p=Number(els.practicePulse.value),answer=Number(els.practiceAnswer.value),expected=p%10;var f=els.practiceFeedback;if(els.practiceAnswer.value==="" ){f.textContent="Enter a decimal value first.";f.className="practice-feedback incorrect";return}
 if(answer===expected){f.textContent="Correct. Pulse "+p+" gives "+bcd(expected).join("")+"₂ = "+expected+"₁₀.";f.className="practice-feedback correct"}else{f.textContent="Not quite. At pulse "+p+", the expected output is "+bcd(expected).join("")+"₂ = "+expected+"₁₀.";f.className="practice-feedback incorrect"}}
function initSequence(){var box=$("sequenceTrack");for(var i=0;i<=10;i++){var v=i%10,el=document.createElement("button");el.className="seq-cell";el.dataset.pulse=i;el.innerHTML="<b>"+bcd(v).join("")+"</b><small>"+i+" pulse"+(i===1?"":"s")+" · "+v+"</small>";el.addEventListener("click",function(){var p=Number(this.dataset.pulse);state.value=p%10;display();document.querySelectorAll(".seq-cell").forEach(function(c){c.classList.toggle("selected",c===this)},this)});box.appendChild(el)}}
function demoSequence(){if(state.sequenceTimer)clearInterval(state.sequenceTimer);restartExperiment();var n=0;state.sequenceTimer=setInterval(function(){if(n++>=10){clearInterval(state.sequenceTimer);state.sequenceTimer=null;return}pulse()},550)}
var manualData=[
["I","Practical Significance","The decade counter is a basic sequential logic circuit used to count events and divide a clock frequency by ten. This experiment connects digital logic theory with a practical integrated circuit and shows how BCD outputs represent decimal digits."],
["II","Industry / Employer Expected Outcomes","A learner should be able to identify a digital IC from its datasheet, interpret pin diagrams, build and verify a counter circuit, use safe lab wiring practices, and diagnose a logic circuit by observing its inputs and outputs."],
["III","Course Level Learning Outcomes","Understand the operation of combinational and sequential logic circuits; explain flip-flop based counters; interpret timing diagrams and truth tables; apply digital ICs to practical counting and frequency division."],
["IV","Laboratory Learning Outcomes","After this practical, the learner can: identify the IC 7490 pins; connect its supply and clock; configure MOD-10 operation by connecting QA to Clock B; observe the BCD count sequence; and verify reset, preset, and rollover behavior."],
["V","Relevant Affective Domain Outcomes","Work carefully and systematically; follow laboratory safety rules; keep connections neat; share instruments responsibly; record observations honestly; and check results before drawing a conclusion."],
["VI","Relevant Theoretical Background","The 7490 is a ripple counter made from a divide-by-2 section and a divide-by-5 section. Clock A (pin 14) clocks the first section and QA (pin 12) is its output. Clock B (pin 1) clocks the second section. Connecting QA to Clock B combines the sections into a divide-by-10 decade counter. Outputs QA, QB, QC, QD have binary weights 1, 2, 4, 8. The device responds to HIGH-to-LOW clock transitions. R0(1), R0(2) asynchronously clear to 0000 when both are HIGH; R9(1), R9(2) asynchronously preset to 1001 when both are HIGH."],
["VII","Circuit Diagram","Use the interactive circuit in the Simulator tab. For decade operation, connect the input clock to pin 14 and connect QA pin 12 to Clock B pin 1. Connect +5 V to pin 5 and ground to pin 10. Keep both reset and both preset inputs LOW for normal counting. Connect each output LED through a current-limiting resistor."],
["VIII","Resources Required","IC 7490 decade counter, regulated +5 V DC supply, clock pulse source or debounced manual switch, four LEDs, current-limiting resistors (typically 330 Ω to 1 kΩ), breadboard, jumper wires, and a digital multimeter or logic probe."],
["IX","Precautions","Check the notch and pin numbering before wiring. Switch OFF power while changing connections. Observe the correct supply polarity and common ground. Use a current-limiting resistor with every LED. Keep asynchronous reset and preset inputs LOW during counting. Avoid driving reset and preset pairs HIGH simultaneously. Do not leave control inputs floating."],
["X","Procedure","1. Identify IC 7490 and locate pin 1 from the package notch. 2. Insert the IC across the breadboard centre gap. 3. Connect pin 5 to +5 V and pin 10 to ground. 4. Connect the clock source to pin 14. 5. Connect QA pin 12 to Clock B pin 1. 6. Hold reset pins 2 and 3 and preset pins 6 and 7 LOW. 7. Connect QA, QB, QC, and QD to LEDs through resistors. 8. Apply pulses and record each output from 0 through 10."],
["XI","Resources Used","The supplied reference material includes the IC 7490 internal block diagram, DIP pin configuration, sample decade-counter circuit, and Observation Table 17.1. Refer to the IC manufacturer's datasheet when checking electrical limits and package details."],
["XII","Actual Procedure","editable:actualProcedure"],
["XIII","Observation","Record the output sequence in Observation Table 17.1. For the standard decade configuration, the stable states are 0000 through 1001, then 0000 again. The table includes pulse counts 0–10 to show the rollover after ten pulses."],
["XIV","Results","editable:results"],
["XV","Interpretation of Results","editable:interpretation"],
["XVI","Conclusion and Recommendations","editable:conclusion"],
["XVII","Practical Related Questions","1. What is the function of the divide-by-2 section? 2. Why is QA connected to Clock B for decade counting? 3. What is the decimal value of QD QC QB QA = 1011? 4. Which edge advances the 7490? 5. Which input pair resets the count to zero? 6. Which input pair presets the count to nine? 7. What is the output after the 10th pulse? 8. Why should an LED be connected through a resistor?"]
];
function manualHtml(){var root=$("manualList");manualData.forEach(function(item,index){var d=document.createElement("details");d.className="manual-section panel";if(index===0||index===5)d.open=true;var summary=document.createElement("summary");summary.innerHTML="<b>"+item[0]+". "+item[1]+"</b><small>SECTION "+item[0]+"</small>";var body=document.createElement("div");body.className="manual-body";
 if(item[2].indexOf("editable:")===0){var key=item[2].split(":")[1];var stored=localStorage.getItem("manual-"+key)||"";body.innerHTML='<p>Write your own lab record below. It is saved automatically in this browser.</p><textarea id="field-'+key+'" placeholder="Enter '+item[1].toLowerCase()+'...">'+escapeHtml(stored)+'</textarea><div class="saved-note" id="saved-'+key+'">Saved on this device</div>'}
 else body.innerHTML="<p>"+escapeHtml(item[2]).replace(/\n/g,"<br>")+"</p>";
 d.appendChild(summary);d.appendChild(body);root.appendChild(d);
 if(item[2].indexOf("editable:")===0){var key2=item[2].split(":")[1],ta=$("field-"+key2);ta.addEventListener("input",function(){localStorage.setItem("manual-"+key2,ta.value);$("saved-"+key2).textContent="Saved · "+new Date().toLocaleTimeString()})}
 })}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function initNavigation(){document.querySelectorAll(".nav-link").forEach(function(btn){btn.addEventListener("click",function(){document.querySelectorAll(".nav-link").forEach(function(b){b.classList.toggle("active",b===btn)});document.querySelectorAll(".view").forEach(function(v){v.classList.toggle("active",v.id==="view-"+btn.dataset.view)});window.scrollTo({top:0,behavior:"smooth"})})})}
function wiring(){
 var toggle=$("guidedToggle"),checks=$("connectionChecks"),panel=$("breadboardPanel");
 $("breadboardBtn").addEventListener("click",function(){panel.hidden=false;panel.scrollIntoView({behavior:"smooth",block:"center"})});
 $("closeBreadboard").addEventListener("click",function(){panel.hidden=true});
 toggle.addEventListener("change",function(){checks.classList.toggle("visible",toggle.checked)});
 $("validateWiring").addEventListener("click",function(){var boxes=checks.querySelectorAll("input"),missing=[];boxes.forEach(function(b){if(!b.checked)missing.push(b.parentElement.textContent.trim())});var f=$("wiringFeedback");if(missing.length){f.textContent="Check these connections: "+missing.join("; ")+".";f.className="control-message warn"}else{f.textContent="Wiring checks pass. +5 V and GND are present, QA feeds Clock B, and LEDs are current-limited.";f.className="control-message good";toast("Connection check passed.")}})
}
function quizInit(){var qs=[{q:"Which output has the 8's weight?",a:["QA","QB","QC","QD"],k:3},{q:"Which edge advances the 7490?",a:["LOW-to-HIGH","HIGH-to-LOW","Either edge","No clock edge"],k:1},{q:"What is the output after the 10th pulse?",a:["1001","1010","0000","0001"],k:2}];var n=0;function show(){var q=qs[n];$("quizQuestion").textContent=(n+1)+" / "+qs.length+" · "+q.q;$("quizOptions").innerHTML="";q.a.forEach(function(a,i){var label=document.createElement("label");label.className="quiz-option";label.innerHTML="<input type=\"radio\" name=\"quizAnswer\" value=\""+i+"\"><span>"+a+"</span>";$("quizOptions").appendChild(label)});$("quizFeedback").textContent="";$("quizFeedback").className="practice-feedback"}$("quizCheck").addEventListener("click",function(){var selected=document.querySelector("input[name=quizAnswer]:checked"),f=$("quizFeedback");if(!selected){f.textContent="Choose an answer first.";f.className="practice-feedback incorrect";return}if(Number(selected.value)===qs[n].k){n=(n+1)%qs.length;f.textContent="Correct!";f.className="practice-feedback correct";setTimeout(show,850)}else{f.textContent="Try again. Review the pin map and counting sequence.";f.className="practice-feedback incorrect"}});show()}
function init(){
 manualHtml();initNavigation();initSequence();fillPractice();quizInit();display();
 els.pulseBtn.addEventListener("click",pulse);els.stepBtn.addEventListener("click",pulse);
 els.startBtn.addEventListener("click",startAuto);els.pauseBtn.addEventListener("click",function(){stopAuto();els.autoToggle.checked=false});
 els.resetBtn.addEventListener("click",function(){state.value=0;display();toast("Counter cleared to 0000.")});
 $("restartBtn").addEventListener("click",restartExperiment);
 $("clearTableBtn").addEventListener("click",function(){rows={};updateTable();toast("Observation table cleared. Restart to record from pulse 0.")});
 $("csvBtn").addEventListener("click",csvExport);
 $("printBtn").addEventListener("click",function(){document.querySelectorAll(".view").forEach(function(v){v.style.display=v.id==="view-simulator"?"block":"none"});window.print();setTimeout(function(){document.querySelectorAll(".view").forEach(function(v){v.style.display=""})},300)});
 $("manualPrint").addEventListener("click",function(){document.querySelectorAll(".view").forEach(function(v){v.style.display=v.id==="view-manual"?"block":"none"});window.print();setTimeout(function(){document.querySelectorAll(".view").forEach(function(v){v.style.display=""})},300)});
 els.speedRange.addEventListener("input",setPeriod);els.autoToggle.addEventListener("change",function(){if(els.autoToggle.checked)startAuto();else stopAuto()});
 ["resetR1","resetR2","setS1","setS2"].forEach(function(id){$(id).addEventListener("change",updateControls)});
 $("checkPractice").addEventListener("click",checkPractice);els.practiceAnswer.addEventListener("keydown",function(e){if(e.key==="Enter")checkPractice()});
 $("zoomIn").addEventListener("click",function(){state.waveZoom=Math.min(2,state.waveZoom+.25);$("zoomLabel").textContent=state.waveZoom+"×";drawWaves()});
 $("zoomOut").addEventListener("click",function(){state.waveZoom=Math.max(.5,state.waveZoom-.25);$("zoomLabel").textContent=state.waveZoom+"×";drawWaves()});
 $("clearWave").addEventListener("click",clearWaves);
 $("pauseWave").addEventListener("click",function(){state.wavePaused=!state.wavePaused;this.textContent=state.wavePaused?"▶ Resume":"Ⅱ Pause";this.title=state.wavePaused?"Resume timing updates":"Pause timing updates";});
 // When paused, retain the last rendered trace while counting continues.
 var originalDraw=drawWaves;drawWaves=function(){if(!state.wavePaused)originalDraw()};
 $("demoSequence").addEventListener("click",demoSequence);
 $("inspectBtn").addEventListener("click",function(){document.querySelector('[data-view="learn"]').click();toast("Pin guide opened in Learn.")});
 $("tableInfoBtn").addEventListener("click",function(){toast("The first 11 readings show pulse counts 0 through 10.")});
 wiring();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();




