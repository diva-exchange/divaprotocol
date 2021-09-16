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

import {suite, slow, timeout, test} from '@testdeck/mocha';
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import { Config } from '../src/config';
import rewire from 'rewire';

const db = rewire("../src/db");

chai.use(sinonChai);

@suite
class TestDb {
    static config: Config;
    static dbClass;
    static dbInstance;

    static before() {
        this.config = new Config({});
        this.dbClass = db.__get__('Db');
        this.dbInstance = this.dbClass.make(TestDb.config);
    }

    static after() {


    }
/*
    @test
    testUpdateByKeyFail() {
        expect(TestDb.dbInstance).to.be.instanceOf(TestDb.dbClass);
        return  TestDb.dbInstance.updateByKey().then((result) => {
            throw new Error('KEY DOES NOT EXIST');
        }).catch((err) => {
            expect(err).to.be.instanceOf(Error);
            expect(err.message).to.equal('KEY DOES NOT EXIST');
        });
    }

    @test
    testUpdateByKey() {

        expect(TestDb.dbInstance).to.be.instanceOf(TestDb.dbClass);
        return  TestDb.dbInstance.updateByKey('key', {}).then((result) => {
            throw new Error('');
        }).catch((err) => {
            expect(err).to.be.instanceOf(Error);
        });
    }*/
}