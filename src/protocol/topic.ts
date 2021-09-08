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

type cTopic = {
  channel: string;
  contract: string;
};

export class Topic {
  private readonly _topics: Array<cTopic>;
  private static topicInstance: Topic;

  public static make() {
    return this.topicInstance || (this.topicInstance = new this());
  }

  private constructor() {
    this._topics = [];
  }

  public subscribeTopic(channel: string, contract: string) {
    let addNew: boolean = true;
    this._topics.forEach((item, index) => {
      if (item.channel === channel &&  item.contract === contract ) {
        addNew = false;
      }
    });
    if (addNew) {
      this._topics.push({ channel: channel, contract: contract });
    }
  }

  public unsubscribeTopic(channel: string, contract: string) {
    this._topics.forEach((item, index) => {
      if (item.channel === channel &&  item.contract === contract ) {
        this._topics.splice(index, 1);
      }
    });
  }

  public getTopics(): Array<cTopic> {
    return this._topics;
  }
}
