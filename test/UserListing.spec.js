const request = require('supertest');
const app = require('../src/app');
const User = require('../src/user/User');
const sequelize = require('../src/config/database');
const bcrypt = require('bcrypt');

beforeAll(async () => {
  if (process.env.NODE_ENV === 'test') {
    await sequelize.sync();
  }
  jest.setTimeout(20000);
});
beforeEach(async () => {
  await User.destroy({ truncate: { cascade: true } });
});

const auth = async (options = {}) => {
  let agent = request(app);
  let token;
  if (options.auth) {
    const response = await agent.post('/api/1.0/auth').send(options.auth);
    token = response.body.token;
  }
  return token;
};

const getUsers = (options = {}) => {
  const agent = request(app).get('/api/1.0/users');
  if (options.token) {
    agent.set('Authorization', `Bearer ${options.token}`);
  }
  return agent;
};
const addUsers = async (activeUserCount, inactiveUserCount = 0) => {
  const hash = await bcrypt.hash('P4ssword', 10);
  for (let i = 0; i < activeUserCount + inactiveUserCount; i++) {
    await User.create({
      username: `user${i + 1}`,
      email: `user${i + 1}@email.com`,
      inactive: i >= activeUserCount,
      password: hash,
    });
  }
};
describe('Listing Users', () => {
  it('returns 200 ok when there are no users in database', async () => {
    const response = await getUsers();
    expect(response.status).toBe(200);
  });

  it('returns page object as response body', async () => {
    const response = await getUsers();
    expect(response.body).toEqual({
      content: [],
      page: 0,
      size: 10,
      totalPages: 0,
    });
  });

  it('returns 10 users in page content when there are 11 users in database', async () => {
    await addUsers(11);
    const response = await getUsers();
    expect(response.body.content.length).toBe(10);
  });

  it('returns 6 users in page content when there are 6 active users and 5 inactive users in database', async () => {
    await addUsers(6, 5);
    const response = await getUsers();
    expect(response.body.content.length).toBe(6);
  });

  it('returns only id, username, email and image in content array for each user', async () => {
    await addUsers(11);
    const response = await getUsers();
    const user = response.body.content[0];
    expect(Object.keys(user)).toEqual(['id', 'username', 'email', 'image']);
  });

  it('returns 2 as total pages when there are 15 active and 7 inactive users', async () => {
    await addUsers(15, 7);
    const response = await getUsers();
    expect(response.body.totalPages).toBe(2);
  });

  it('returns second page users and page indicator when page is set as 1 in request parameter', async () => {
    await addUsers(11);
    /**request(app).get('/api/1.0/users?page=1')*/
    const response = await getUsers().query({ page: 1 });
    expect(response.body.content[0].username).toBe('user11');
    expect(response.body.page).toBe(1);
  });

  it('returns first page users page is set below below zero in request parameter', async () => {
    await addUsers(11);
    /**request(app).get('/api/1.0/users?page=1')*/
    const response = await getUsers().query({ page: -2 });
    expect(response.body.page).toBe(0);
  });

  it('returns 5 users and corresponding size indicator when size is set as 5 in request parameter ', async () => {
    await addUsers(11);
    /**request(app).get('/api/1.0/users?size=1')*/
    const response = await getUsers().query({ size: 5 });
    expect(response.body.content.length).toBe(5);
    expect(response.body.size).toBe(5);
  });

  it('returns 10 users and corresponding size indicator when size is set as 1000 in request parameter ', async () => {
    await addUsers(11);
    /**request(app).get('/api/1.0/users?size=1')*/
    const response = await getUsers().query({ size: 1000 });
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  });

  it('returns 10 users and corresponding size indicator when size is set as 0 in request parameter ', async () => {
    await addUsers(11);
    /**request(app).get('/api/1.0/users?size=1')*/
    const response = await getUsers().query({ size: 0 });
    expect(response.body.content.length).toBe(10);
    expect(response.body.size).toBe(10);
  });

  it('returns page as 0 and size as 10 when non-numeric query params as provided for both ', async () => {
    await addUsers(11);
    /**request(app).get('/api/1.0/users?size=1')*/
    const response = await getUsers().query({ page: 'page', size: 'size' });
    expect(response.body.page).toBe(0);
    expect(response.body.size).toBe(10);
  });

  it('returns page without user when request has valid authorisation', async () => {
    await addUsers(11);
    const token = await auth({
      auth: { email: 'user1@email.com', password: 'P4ssword' },
    });
    const response = await getUsers({ token: token });
    expect(response.body.totalPages).toBe(1);
  });
});

describe('Get User', () => {
  const getUser = (id = 5) => {
    return request(app).get('/api/1.0/users/' + id);
  };
  it('returns 404 and User not found message when user not found in database', async () => {
    const response = await getUser();
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('User not found');
  });

  it('returns proper error body when user not found in database', async () => {
    const nowInMills = new Date().getTime();
    const response = await getUser();
    const error = response.body;
    expect(error.path).toBe('/api/1.0/users/5');
    expect(error.timestamp).toBeGreaterThan(nowInMills);
    expect(response.status).toBe(404);
    expect(Object.keys(error)).toEqual(['path', 'timestamp', 'message']);
  });
  it('returns 200 when an active user exists', async () => {
    const user = await User.create({
      username: `user1`,
      email: `user1@email.com`,
      inactive: false,
    });
    const response = await getUser(user.id);
    expect(response.status).toBe(200);
  });

  it('returns id, username, email and image in response body when an active user exists', async () => {
    const user = await User.create({
      username: `user1`,
      email: `user1@email.com`,
      inactive: false,
    });
    const response = await getUser(user.id);
    expect(Object.keys(response.body)).toEqual([
      'id',
      'username',
      'email',
      'image',
    ]);
  });

  it('returns 404 when the user is  inactive', async () => {
    const user = await User.create({
      username: `user1`,
      email: `user1@email.com`,
      inactive: true,
    });
    const response = await getUser(user.id);
    expect(response.status).toBe(404);
  });
});
