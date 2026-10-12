class Thing(object):
    """ Most objects clients interact with are Things

        Created with :func:`new_thing`, things are objects with a few
        attributes added on, mostly for enabling in-game reference of the
        objects.
    """

    def __init__(self, **kwargs):
        self.__name__ = 'thing'
        self.nouns = {'thing'}
        self.adjectives = set()
        self.update(kwargs)
        return

    @property
    def name(self):
        """ Properly-cased full name of a thing
            Any name a thing is given is also added to :attr:`Thing.nouns`,
            with the old name being removed. Same for adjectives.

            .. warning:: This has some wonkiness, in that "Eric Baez" can be
                         referred to as "Eric Baez" or "Baez" but not "Eric".
                         "Eric Thing" would work, though.
        """
        return self._name

    @name.setter
    def name(self, value):
        old_name = self._name.lower().split(' ')
        if len(old_name) > 1:
            old_adjectives = old_name[0:-1]
            for adjective in old_adjectives:
                try:
                    self.adjectives.remove(adjective)
                except KeyError:
                    pass
        try:
            self.nouns.remove(old_name[-1])
        except KeyError:
            pass
        new_name = value.lower().split(' ')
        self.nouns.add(new_name[-1])
        if len(new_name) > 1:
            adjectives = new_name[0:-1]
            for adjective in adjectives:
                self.adjectives.add(adjective)
        self.nouns.add(new_name[-1])
        self._name = value

    def update(self, attributes):
        """ Update multiple attributes of Thing at once.

            Example:
                >>> foo = Thing()
                >>> foo.update({'name': 'eric'})
                >>> foo.name
                eric

            .. warning:: Does not properly recognize setters
        """
        # todo account for custom setters
        for attribute, value in attributes.items():
            if hasattr(self, attribute):
                self.__dict__[attribute] = value
        return True


