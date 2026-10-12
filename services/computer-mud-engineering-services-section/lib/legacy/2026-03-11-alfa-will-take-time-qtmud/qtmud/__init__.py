"""This module is the core of the qtMUD game engine.

    .. versionadded:: 0.0.1

This module contains the qtmudEngine class and establishes some core
configuration.
"""

import logging
import sys
from logging.config import dictConfig

import qtmud.thing

__version__ = '0.1.0'
"""int: The engine's version.

    .. versionadded:: 0.0.1

This variable is usually used with the builtin ``__name__`` to provide
information about the codebase.  An instanced :class:`Driver` will
also set its own ``__name__`` and ``__verison__`` equal to the
``qtmud`` modules'.

"""
__url__ = 'https://qtmud.readthedocs.io/en/latest/'
""" The engine's main website.

    .. versionadded:: 0.0.2

"""
feature_data = {
    'colored_output' : { 'requirements' : ['termcolor'] },
}
"""dict: Information about optional features.

    .. versionadded:: 0.1.0

This dictionary contains information about qtMUD's various optional features, following the schema::
    feature_name : { 'requirements' : feature_requirements }

Where ``feature_name`` is a lowercase_underscore_spaced unique term
for the optional feature, and ``feature_requirements`` is a list of
strings, where each string is a module to import.

"""
logging_config = dict(version=1,
                      formatters={'f': {'format': ('\033[34m%(asctime)s\033[0m \033[34;1m%(name)s\033[0m \n\033[32m%(levelname)-8s\033[0m %(message)s'),
                                        'datefmt': ('%Y%m%d %I%M:%S')}},
                      handlers={'stream': {'class': 'logging.StreamHandler', 'formatter': 'f', 'level': logging.DEBUG}},
                      root={'handlers': ['stream'], 'level': logging.INFO})
"""dict: Defines preloaded logging format.

    .. versionadded:: 0.1.0

This dictionary is used to set :class:`qtmudEngine`'s logging
configuration when its initialized.  For more information on the
format, see :func:`logging.config.DictConfig` for more
information.

"""

class Driver():
    """The main MUD driver.

        .. versionadded:: 0.1.0

    This class is the main MUD driver. 

    Attributes
    ----------
    __name__ : str
        The engine's name.  Set to the module's ``__name__``. 
    __version__: str
        The engine's version.  Set to the module's ``__version__``.
    log : :class:`logging.Logger`
        The engine's logger object.
    thing_template : :class:`qtmud.thing.Thing`
        The template Thing that'll be instanced and returned by :func:`new_thing`
    """
    def __init__(self):
        self.__name__ = __name__
        self.__version__ = __version__
        self.logging_config = logging_config
        logging.config.dictConfig(self.logging_config)
        self.log = logging.getLogger(__name__)
        self.thing_template = qtmud.thing.Thing
        return
    
    def load(self, optional_features=[], mudlibs=[], services=[]):
        """Load optional features, mud libraries, services, and subscriptions.

            .. versionadded:: 0.1.0        

        Parameters
        ----------
        optional_features : list
            The names (as strings) of the optional features to load.  Strings should match :attr:`qtmud.feature_data` keys.
        mudlib : list
            The names (as strings) of the modules to be imported as MUD libraries.
        services : list
            The names (as strings) of the classes to instanced as driver services.

        Returns
        -------
        bool
            True unless there is a critical exception.



        """
        log = self.log.getChild('load()')
        log.debug('Driver is loading.')
