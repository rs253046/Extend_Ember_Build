import Ember from 'ember';

export default Ember.Route.extend({
	model() {
		return Ember.RSVP.hash ({
      title: "Extend Ember Build",
      description: "Every build will fail until it passes jshint."
		});
	}
})
