import Logger from './Logger';
import Turn from './Turn';

/** Class representing a unit. */
class Unit {
  /**
   * Creates a unit.
   *
   * @param {string} name The name of the unit.
   * @param {string} character The character of the unit.
   * @param {number} maxHealth The max health in HP.
   * @param {number} reward The number of points to reward when killed.
   * @param {boolean} captive Whether the unit is a captive or not.
   */
  constructor(name, character, maxHealth, reward = null, captive = false) {
    this.name = name;
    this.character = character;
    this.maxHealth = maxHealth;
    this.reward = reward === null ? maxHealth : reward;
    this.captive = captive;
    this.abilities = new Map();
    this.effects = new Map();
    this.health = maxHealth;
    this.position = null;
    this.bound = captive;
    this.score = 0;
    this.turn = null;
  }

  /**
   * Adds an ability to the unit.
   *
   * @param {string} name The name of the ability.
   * @param {Object} ability The ability to add.
   */
  addAbility(name, ability) {
    this.abilities.set(name, ability);
  }

  /**
   * Adds an effect to the unit.
   *
   * @param {string} name The name of the effect.
   * @param {Object} effect The effect to add.
   */
  addEffect(name, effect) {
    this.effects.set(name, effect);
  }

  /**
   * Checks if the unit is under the given effect.
   *
   * @param {string} name The name of the effect.
   *
   * @returns {boolean} Whether the unit is under the effect or not.
   */
  isUnderEffect(name) {
    return this.effects.has(name);
  }

  /**
   * Triggers the given effect.
   *
   * @param {string} name The name of the effect.
   */
  triggerEffect(name) {
    const effect = this.effects.get(name);
    if (effect) {
      effect.trigger();
    }
  }

  /**
   * Returns the next turn to be played.
   *
   * @returns {Turn} The next turn.
   */
  getNextTurn() {
    return new Turn(this.abilities);
  }

  /**
   * Prepares the next turn to be played.
   *
   * This is when methods of the turn instance that correspond to abilities are
   * executed. The senses will be executed immediately, whereas the action is
   * stored in a property of the turn instance for deferred execution (when
   * performing the turn later).
   */
  prepareTurn() {
    this.turn = this.getNextTurn();
    this.playTurn(this.turn);
  }

  /**
   * Performs the prepared turn.
   */
  performTurn() {
    if (this.isAlive()) {
      this.effects.forEach(effect => effect.passTurn());
      if (this.turn.action && !this.isBound()) {
        const [name, args] = this.turn.action;
        this.abilities.get(name).perform(...args);
      }
    }
  }

  /**
   * Checks if the unit is a captive.
   *
   * @returns {boolean} Whether the unit is a captive or not.
   */
  isCaptive() {
    return this.captive;
  }

  /**
   * Adds the given amount of health in HP.
   *
   * @param {number} amount The amount of HP to add.
   */
  heal(amount) {
    const revisedAmount =
      this.health + amount > this.maxHealth
        ? this.maxHealth - this.health
        : amount;
    this.health += revisedAmount;

    this.say(`receives ${amount} health, up to ${this.health} health`);
  }

  /**
   * Subtracts the given amount of health in HP.
   *
   * @param {number} amount The amount of HP to subtract.
   */
  takeDamage(amount) {
    if (this.isBound()) {
      this.unbind();
    }

    const revisedAmount = this.health - amount < 0 ? this.health : amount;
    this.health -= revisedAmount;

    this.say(`takes ${amount} damage, ${this.health} health power left`);

    if (!this.health) {
      this.say('dies');
      this.vanish();
    }
  }

  /**
   * Damages another unit.
   *
   * @param {Unit} receiver The unit to damage.
   * @param {number} amount The amount of HP to inflict.
   */
  damage(receiver, amount) {
    receiver.takeDamage(amount);
    if (!receiver.isAlive()) {
      this.earnPoints(receiver.reward);
    }
  }

  /**
   * Checks if the unit is alive.
   *
   * A unit is alive if it has a position.
   *
   * @returns {boolean} Whether the unit is alive or not.
   */
  isAlive() {
    return this.position !== null;
  }

  /**
   * Checks if the unit is bound.
   *
   * @returns {boolean} Whether the unit is bound or not.
   */
  isBound() {
    return this.bound;
  }

  /**
   * Unbinds the unit.
   */
  unbind() {
    this.bound = false;
    this.say('released from bonds');
  }

  /**
   * Binds the unit.
   */
  bind() {
    this.bound = true;
  }

  /**
   * Adds the given points to the score.
   *
   * @param {number} points The points to earn.
   */
  earnPoints(points) {
    this.score += points;
  }

  /**
   * Returns the units in the floor minus this unit.
   *
   * @returns {Unit[]} The other units in the floor.
   */
  getOtherUnits() {
    return this.position.floor.getUnits().filter(unit => unit !== this);
  }

  /**
   * Returns the space where this unit is located.
   *
   * @returns {Space} The space this unit is located at.
   */
  getSpace() {
    return this.position.getSpace();
  }

  /**
   * Returns the space located at the direction and number of spaces.
   *
   * @param {string} direction The direction.
   * @param {number} forward The number of spaces forward.
   * @param {number} right The number of spaces to the right.
   *
   * @returns {Space} The space.
   */
  getSpaceAt(direction, forward = 1, right = 0) {
    return this.position.getRelativeSpace(direction, [forward, right]);
  }

  /**
   * Returns the direction of the stairs with reference to this unit.
   *
   * @returns {string} The relative direction of the stairs.
   */
  getDirectionOfStairs() {
    return this.getDirectionOf(this.position.floor.getStairsSpace());
  }

  /**
   * Returns the direction of the given space with reference to this unit.
   *
   * @param {Space} space The space to get the direction of.
   *
   * @returns {string} The relative direction of the space.
   */
  getDirectionOf(space) {
    return this.position.getRelativeDirectionOf(space);
  }

  /**
   * Returns the distance between the given space and this unit.
   *
   * @param {Space} space The space to calculate the distance of.
   *
   * @returns {number} The distance of the space.
   */
  getDistanceOf(space) {
    return this.position.getDistanceOf(space);
  }

  /**
   * Moves the unit in the given direction and number of spaces.
   *
   * @param {string} direction The direction.
   * @param {number} forward The number of spaces forward.
   * @param {number} right The number of spaces to the right.
   */
  move(direction, forward = 1, right = 0) {
    this.position.move(direction, [forward, right]);
    this.say();
  }

  /**
   * Rotates the unit in a given direction.
   *
   * @param {string} direction The direction in which to rotate.
   */
  rotate(direction) {
    this.position.rotate(direction);
    this.say();
  }

  /**
   * Vanishes the unit from the floor.
   */
  vanish() {
    this.position = null;
    this.say();
  }

  /**
   * Logs a message with the accompanying unit.
   *
   * @param {string} message The message to log.
   */
  say(message) {
    Logger.unit(this, message);
  }

  /**
   * Returns the string representation of this unit.
   *
   * @returns {string} The string representation.
   */
  toString() {
    return this.name;
  }

  /**
   * Customizes the JSON stringification behavior of the unit.
   *
   * @returns {Object} The value to be serialized.
   */
  toJSON() {
    return {
      name: this.name,
      character: this.character,
      maxHealth: this.maxHealth,
      health: this.health,
    };
  }
}

export default Unit;
