// Original sample records. Dates are relative to the day setup is first run.
const addDays = n => { const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+n); return d.toLocaleDateString('en-CA'); };
const demoUsers = [
  {id:'u-student',name:'Alex Morgan',email:'student@campus.edu',role:'student',department:'Computer Science',year:'Third Year',phone:'',initials:'AM',demo:true},
  {id:'u-faculty',name:'Dr. Priya Shah',email:'faculty@campus.edu',role:'faculty',department:'Computer Science',year:'Faculty',phone:'',initials:'PS',demo:true},
  {id:'u-admin',name:'Campus Administrator',email:'admin@campus.edu',role:'admin',department:'Administration',year:'Staff',phone:'',initials:'CA',demo:true}
];
function seed(){
  const created = days => new Date(Date.now()-days*86400000).toISOString();
  return {
    users:demoUsers.map(x=>({...x})),
    complaints:[
      {id:'CMP-1042',title:'Projector not working in Room 204',category:'Classroom',location:'Academic Block A, 204',description:'The projector is not powering on during lectures. Please arrange a maintenance check.',priority:'High',status:'In Progress',userId:'u-student',assignedTo:'Maintenance Team',createdAt:created(2),updatedAt:created(1)},
      {id:'CMP-1038',title:'Water leakage near science lab',category:'Maintenance',location:'Science Block, Floor 2',description:'Water is leaking from a pipe close to the laboratory entrance.',priority:'High',status:'Open',userId:'u-student',assignedTo:'Unassigned',createdAt:created(4),updatedAt:created(4)},
      {id:'CMP-1031',title:'Wi-Fi connectivity in library',category:'IT & Network',location:'Central Library',description:'Wi-Fi drops intermittently on the second floor.',priority:'Medium',status:'Resolved',userId:'u-student',assignedTo:'IT Support',createdAt:created(9),updatedAt:created(3)},
      {id:'CMP-1027',title:'Broken desk in lecture hall',category:'Infrastructure',location:'Block B, Room 110',description:'Two desks have damaged legs and need replacement.',priority:'Low',status:'Open',userId:'u-faculty',assignedTo:'Unassigned',createdAt:created(5),updatedAt:created(5)},
      {id:'CMP-1022',title:'Air conditioning issue in lab',category:'Maintenance',location:'Computer Lab 3',description:'AC is not cooling the computer lab.',priority:'Medium',status:'In Progress',userId:'u-faculty',assignedTo:'Maintenance Team',createdAt:created(6),updatedAt:created(2)},
    ],
    items:[
      {id:'LF-201',type:'Lost',title:'Black wireless headphones',category:'Electronics',location:'Central Library',description:'Black over-ear headphones in a grey carrying case.',userId:'u-student',date:addDays(-2),status:'Active',emoji:'🎧',claims:[]},
      {id:'LF-202',type:'Found',title:'Blue water bottle',category:'Personal Items',location:'Sports Complex',description:'Metal insulated bottle found near the badminton court.',userId:'u-faculty',date:addDays(-1),status:'Active',emoji:'🧴',claims:[]},
      {id:'LF-203',type:'Found',title:'Student ID card',category:'Documents',location:'Cafeteria',description:'Found a campus ID card at the main cafeteria counter.',userId:'u-admin',date:addDays(-3),status:'Active',emoji:'🪪',claims:[]},
      {id:'LF-204',type:'Lost',title:'Scientific calculator',category:'Electronics',location:'Academic Block B',description:'Grey Casio scientific calculator misplaced after lecture.',userId:'u-faculty',date:addDays(-4),status:'Active',emoji:'🧮',claims:[]},
      {id:'LF-205',type:'Found',title:'Green notebook',category:'Stationery',location:'Reading Hall',description:'A hardcover green notebook with engineering notes.',userId:'u-admin',date:addDays(-2),status:'Active',emoji:'📗',claims:[]},
      {id:'LF-206',type:'Lost',title:'Bike keys on orange lanyard',category:'Keys',location:'Parking Area C',description:'Set of two keys attached to an orange lanyard.',userId:'u-student',date:addDays(-1),status:'Active',emoji:'🔑',claims:[]}
    ],
    events:[
      {id:'EV-301',title:'Innovation & Tech Summit',category:'Technology',date:addDays(5),time:'10:00',location:'Main Auditorium',description:'A day of student innovations, technology demos, and inspiring talks from industry guests.',capacity:180,attendees:['u-student'],emoji:'💡',color:'blue'},
      {id:'EV-302',title:'Campus Cultural Fest',category:'Culture',date:addDays(12),time:'16:00',location:'Open Air Theatre',description:'Celebrate music, dance, and creative performances from campus clubs.',capacity:400,attendees:[],emoji:'🎭',color:'pink'},
      {id:'EV-303',title:'Design Thinking Workshop',category:'Workshop',date:addDays(8),time:'14:00',location:'Seminar Hall 2',description:'Hands-on problem solving, prototyping, and collaborative idea generation.',capacity:60,attendees:['u-faculty'],emoji:'🎨',color:'purple'},
      {id:'EV-304',title:'Inter-Department Sports Meet',category:'Sports',date:addDays(18),time:'09:00',location:'Sports Ground',description:'Join your department team for a friendly campus-wide sports day.',capacity:250,attendees:[],emoji:'🏅',color:'orange'},
      {id:'EV-305',title:'Career & Internship Connect',category:'Career',date:addDays(20),time:'11:00',location:'Placement Cell',description:'Meet placement mentors and explore internship opportunities.',capacity:120,attendees:[],emoji:'🚀',color:'green'}
    ],
    rooms:[
      {id:'RM-101',name:'Computer Lab 01',building:'Tech Block · Floor 2',type:'Laboratory',capacity:40,equipment:'Computers, Projector, AC',emoji:'💻'},
      {id:'RM-102',name:'Lecture Hall A-204',building:'Academic Block A · Floor 2',type:'Classroom',capacity:80,equipment:'Projector, Smart Board, AC',emoji:'🏫'},
      {id:'RM-103',name:'Seminar Hall 02',building:'Academic Block B · Floor 1',type:'Seminar Hall',capacity:120,equipment:'Audio System, Stage, Projector',emoji:'🎤'},
      {id:'RM-104',name:'Electronics Lab',building:'Science Block · Floor 3',type:'Laboratory',capacity:32,equipment:'Workbenches, Instruments, AC',emoji:'🔬'},
      {id:'RM-105',name:'Discussion Room 03',building:'Library Block · Floor 1',type:'Meeting Room',capacity:12,equipment:'Display, Whiteboard',emoji:'🗣️'},
      {id:'RM-106',name:'Lecture Hall B-101',building:'Academic Block B · Ground',type:'Classroom',capacity:65,equipment:'Projector, Whiteboard, AC',emoji:'📚'},
    ],
    bookings:[
      {id:'BKG-501',roomId:'RM-101',userId:'u-student',date:addDays(3),start:'10:00',end:'12:00',purpose:'Team coding workshop',status:'Approved',createdAt:created(3)},
      {id:'BKG-502',roomId:'RM-103',userId:'u-faculty',date:addDays(5),start:'13:00',end:'15:00',purpose:'Faculty research seminar',status:'Pending',createdAt:created(1)}
    ],
    notices:[
      {id:'NT-601',title:'Mid-semester library hours extended',category:'Academic',body:'The central library will remain open until 10:00 PM on weekdays during the upcoming examination preparation period.',date:created(0),pinned:true},
      {id:'NT-602',title:'Campus network maintenance',category:'Maintenance',body:'Scheduled network maintenance will take place this weekend from 7:00 AM to 9:00 AM. Connectivity may be temporarily interrupted.',date:created(1),pinned:true},
      {id:'NT-603',title:'Registrations open for Cultural Fest',category:'Events',body:'Students can now register for performances and volunteer opportunities at the annual Cultural Fest.',date:created(2),pinned:false},
      {id:'NT-604',title:'Updated classroom booking guidelines',category:'Administrative',body:'Bookings must be requested at least one day before intended use and are subject to administrator approval.',date:created(4),pinned:false},
      {id:'NT-605',title:'Workshop on interview preparation',category:'Events',body:'The placement cell is hosting an interactive interview preparation workshop next week.',date:created(6),pinned:false}
    ],
    notifications:[
      {id:'N-701',userId:'u-student',title:'Complaint status updated',body:'Your projector complaint is being reviewed by the maintenance team.',type:'complaint',read:false,date:created(0)},
      {id:'N-702',userId:'u-student',title:'Registration confirmed',body:'You are registered for Innovation & Tech Summit.',type:'event',read:false,date:created(2)},
      {id:'N-703',userId:'u-student',title:'Booking approved',body:'Your reservation for Computer Lab 01 has been approved.',type:'booking',read:true,date:created(3)},
      {id:'N-704',userId:'u-faculty',title:'Room booking received',body:'Your seminar hall request is awaiting approval.',type:'booking',read:false,date:created(1)},
      {id:'N-705',userId:'u-admin',title:'New complaint received',body:'A complaint about water leakage requires attention.',type:'complaint',read:false,date:created(1)}
    ]
  };
}

module.exports = seed;
