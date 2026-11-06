export class D1Store {
 constructor(db){this.db=db;}
 async configs(user){return (await this.db.prepare('SELECT * FROM video_configs WHERE user_id = ?').bind(user).all()).results;}
 config(user,provider){return this.db.prepare('SELECT * FROM video_configs WHERE user_id = ? AND provider = ?').bind(user,provider).first();}
 async saveConfig(user,provider,config,credentials){await this.db.prepare('INSERT INTO video_configs (user_id,provider,config,credentials,updated_at) VALUES (?,?,?,?,?) ON CONFLICT (user_id,provider) DO UPDATE SET config=excluded.config,credentials=excluded.credentials,updated_at=excluded.updated_at').bind(user,provider,JSON.stringify(config),credentials,Date.now()).run();}
 async deleteConfig(user,provider){await this.db.prepare('DELETE FROM video_configs WHERE user_id = ? AND provider = ?').bind(user,provider).run();}
 async tasks(user){return (await this.db.prepare('SELECT * FROM video_tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').bind(user).all()).results;}
 async usage(user){const row=await this.db.prepare("SELECT COUNT(*) AS total FROM video_tasks WHERE user_id = ? AND status NOT IN ('failed','cancelled')").bind(user).first();return row.total;}
 task(user,id){return this.db.prepare('SELECT * FROM video_tasks WHERE user_id = ? AND id = ?').bind(user,id).first();}
 request(user,id){return this.db.prepare('SELECT * FROM video_tasks WHERE user_id = ? AND request_id = ?').bind(user,id).first();}
 async reserve(row){const result=await this.db.prepare("INSERT OR IGNORE INTO video_tasks (id,user_id,provider,request_id,input_hash,status,config,credentials,title,prompt,duration,aspect,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM video_tasks WHERE user_id = ? AND status NOT IN ('failed','cancelled')) < 10").bind(row.id,row.user_id,row.provider,row.request_id,row.input_hash,row.status,row.config,row.credentials,row.title,row.prompt,row.duration,row.aspect,row.created_at,row.updated_at,row.user_id).run();return result.meta.changes>0;}
 async update(user,id,changes){const allowed=['external_id','status','video_url','error'];const entries=Object.entries(changes).filter(([key])=>allowed.includes(key));if(!entries.length)return;await this.db.prepare(`UPDATE video_tasks SET ${entries.map(([key])=>`${key} = ?`).join(',')}, updated_at = ? WHERE user_id = ? AND id = ?`).bind(...entries.map(([,value])=>value),Date.now(),user,id).run();}
}
