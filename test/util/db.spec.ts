/**
 * Copyright (C) 2021 diva.exchange
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 *
 * Author/Maintainer: Konrad Bächler <konrad@diva.exchange>
 */

import { suite, slow, timeout, test } from '@testdeck/mocha';
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import { Config } from '../../src/config';
import rewire from 'rewire';
import { createSandbox } from 'sinon';

const db = rewire('../../src/util/db');

chai.use(sinonChai);

@suite
class TestDb {
  static config: Config;
  static dbClass;
  static dbInstance;
  static sandbox = createSandbox();
  static findByKey;

  @timeout(10000)
  static before() {
    const sampleData = { test0: 'test0' };
    this.config = new Config({
      path_state: 'test/state/',
    });
    this.dbClass = db.__get__('Db');
    this.dbInstance = this.dbClass.make(this.config);
    this.findByKey = this.sandbox
      .stub(this.dbInstance, 'getValueByKey')
      .resolves(sampleData);
  }

  @timeout(10000)
  static after() {
    this.sandbox.restore();
    this.dbInstance.shutdown();
    this.dbInstance.clear();
  }

  @test
  async testUpdateByKeyFail() {
    expect(TestDb.dbInstance).to.be.instanceOf(TestDb.dbClass);
    return await TestDb.dbInstance
      .updateByKey()
      .then((result) => {
        throw new Error('KEY DOES NOT EXIST');
      })
      .catch((err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('KEY DOES NOT EXIST');
      });
  }

  @test
  async testUpdateByKey() {
    expect(TestDb.dbInstance).to.be.instanceOf(TestDb.dbClass);
    await TestDb.dbInstance
      .updateByKey('key1', {test: 'test'})
      .then((result) => {
        throw new Error('');
      })
      .catch((err) => {
        expect(err).to.be.instanceOf(Error);
      });
    const result = await TestDb.dbInstance.getValueByKey('key1');
    expect(TestDb.findByKey).to.be.calledOnceWith('key1');
    expect(result).to.be.an('object');
    expect(result).to.to.have.property('test0').to.equal('test0');
  }

  @test
  async testGetByKeyFail() {
    await TestDb.dbInstance.getValueByKey('').then((result) => {
      throw new Error('no key specified');
    }).catch((err) => {
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal('no key specified');
    });
  }

  @test
  async testGetByKey() {
    await TestDb.dbInstance.getValueByKey('1').then((result) => {
      expect(TestDb.findByKey).to.be.calledThrice;
      expect(result).to.be.a('Object');
      expect(result).to.have.property('test0').to.equal('test0');
    });
  }
}
