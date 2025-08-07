#!/usr/bin/env python3
"""Setup script for Backstage IDP Python SDK."""

import os
from setuptools import setup, find_packages

# Get the long description from the README file
here = os.path.abspath(os.path.dirname(__file__))
with open(os.path.join(here, 'README.md'), encoding='utf-8') as f:
    long_description = f.read()

# Get version from version file
with open(os.path.join(here, 'backstage_idp_sdk', '_version.py'), encoding='utf-8') as f:
    version_globals = {}
    exec(f.read(), version_globals)
    version = version_globals['__version__']

setup(
    name='backstage-idp-sdk',
    version=version,
    description='Python SDK for Backstage Developer Portal',
    long_description=long_description,
    long_description_content_type='text/markdown',
    author='Backstage Team',
    author_email='support@backstage-idp.com',
    url='https://github.com/backstage/backstage-idp-sdk',
    project_urls={
        'Bug Reports': 'https://github.com/backstage/backstage-idp-sdk/issues',
        'Source': 'https://github.com/backstage/backstage-idp-sdk/tree/main/python',
        'Documentation': 'https://backstage-idp-sdk.readthedocs.io/',
    },
    classifiers=[
        'Development Status :: 4 - Beta',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: Apache Software License',
        'Operating System :: OS Independent',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Programming Language :: Python :: 3.12',
        'Topic :: Software Development :: Libraries :: Python Modules',
        'Topic :: Internet :: WWW/HTTP :: HTTP Servers',
        'Topic :: System :: Software Distribution',
    ],
    keywords='backstage developer-portal sdk api-client graphql websocket',
    packages=find_packages(exclude=['tests', 'tests.*']),
    python_requires='>=3.8',
    install_requires=[
        'httpx>=0.24.0',
        'pydantic>=2.0.0',
        'websockets>=11.0.0',
        'gql[httpx]>=3.4.0',
        'tenacity>=8.2.0',
        'python-dateutil>=2.8.0',
        'typing-extensions>=4.0.0',
        'pyjwt>=2.8.0',
        'cryptography>=41.0.0',
    ],
    extras_require={
        'dev': [
            'pytest>=7.0.0',
            'pytest-asyncio>=0.21.0',
            'pytest-cov>=4.0.0',
            'pytest-mock>=3.10.0',
            'black>=23.0.0',
            'isort>=5.12.0',
            'mypy>=1.5.0',
            'flake8>=6.0.0',
            'pre-commit>=3.0.0',
        ],
        'docs': [
            'sphinx>=7.0.0',
            'sphinx-rtd-theme>=1.3.0',
            'sphinx-autodoc-typehints>=1.24.0',
        ],
        'test': [
            'pytest>=7.0.0',
            'pytest-asyncio>=0.21.0',
            'pytest-cov>=4.0.0',
            'pytest-mock>=3.10.0',
            'respx>=0.20.0',
            'websockets>=11.0.0',
        ],
    },
    package_data={
        'backstage_idp_sdk': ['py.typed'],
    },
    entry_points={
        'console_scripts': [
            'backstage-sdk=backstage_idp_sdk.cli:main',
        ],
    },
    zip_safe=False,
)