import School from './school.js'

export default class SchoolQueue {
  queue = [];

  /* 
    input array data convert them into "School" object and store them in "queue"
  */
  AddSchool(data) {
    data.forEach(dta => {
      const _sch = new School(dta);
      this.queue.push(_sch);
    });
  }

  /* 
    output "queue" in JSON format
  */
  JSON_display() {
    return JSON.stringify(this.queue,undefined,'\t');
  }
}