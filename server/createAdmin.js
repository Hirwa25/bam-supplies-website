const db = require('./database');
const bcrypt = require('bcryptjs');

const name = 'Admin';
const email = 'admin@jfg.co.mz';
const password = 'jfg2026';
const role = 'admin';

const hashedPassword = bcrypt.hashSync(password, 10);

const insert = db.prepare(
    `INSERT OR IGNORE INTO users (name, email, password, role)
    VALUES(?, ?, ?, ?)`
    );

    insert.run(name, email, hashedPassword, role);

    console.log('Admin user created!');
    console.log('Email:', email);
    console.log('Password:', password);
    

    
