import click
import importlib
import logging


@click.command()
@click.option('--conf', default='~/.local/share/qtmud/qtmud.conf', help='Absolute location of qtmud.conf.')
@click.option('--verbose', is_flag=True, help='Show debug, info, warning, error, and critical log messages.')
@click.option('--quiet', is_flag=True, help='Only show warning, error, and critical log messages.')
@click.option('--datadir', default='~/.local/share/qtmud/data/', help='Absolute location of the directory where qtMUD will save data.')
@click.option('--mudlib', default=None, help='Name of the Python module that is the qtMUD library you want to load.')
@click.option('--colored_output/--no_colored_output', default=True, help='Whether to allow output to be colorized.  If true, qtMUD expects the `termcolor` module to be importable.')
def load_start_run(conf, datadir, mudlib, verbose, quiet, colored_output):
    try:
        qtmud = importlib.import_module('qtmud')
        qtmud.log.info('Imported {} version {}'.format(qtmud.engine_name, qtmud.__version__))
    except Exception as err:
        print('Couldn\'t import the qtmud module: {}'.format(err))
        exit()
    if quiet:
        qtmud.log.info('Making the log stream quiet.')
        qtmud.log.setLevel(logging.WARNING)
    elif verbose:
        qtmud.log.info('Making the console output verbose.')
        qtmud.log.setLevel(logging.DEBUG)
    DATA_DIR = datadir
    try:
        qtmud.load(mudlib_name=mudlib, features={'colored_output': colored_output})
        try:
            qtmud.start()
            try:
                qtmud.run()
            except Exception as err:
                qtmud.log.critical('run() failed: {}'.format(err))
        except Exception as err:
            qtmud.log.critical('start() failed: {}'.format(err))
    except Exception as err:
        qtmud.log.critical('load() failed: {}'.format(err))

