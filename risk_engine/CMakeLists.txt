cmake_minimum_required(VERSION 3.20)
project(risk_engine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)
# set(RISK_BALANCE_SEEDS 10)

option(RISK_ENGINE_ENABLE_ASAN "Build with AddressSanitizer" ON)

# 1. Find librdkafka C++ dependencies
find_package(PkgConfig QUIET)

if(PKG_CONFIG_FOUND)
    pkg_check_modules(RDKAFKA_CPP rdkafka++)
endif()

if(NOT RDKAFKA_CPP_FOUND)
    find_path(RDKAFKA_CPP_INCLUDE_DIR 
        NAMES rdkafkacpp.h 
        PATH_SUFFIXES librdkafka
    )
    find_library(RDKAFKA_CPP_LIBRARY NAMES rdkafka++)
    find_library(RDKAFKA_C_LIBRARY NAMES rdkafka)

    if(RDKAFKA_CPP_INCLUDE_DIR AND RDKAFKA_CPP_LIBRARY)
        set(RDKAFKA_CPP_FOUND TRUE)
        set(RDKAFKA_CPP_INCLUDE_DIRS ${RDKAFKA_CPP_INCLUDE_DIR})
        set(RDKAFKA_CPP_LIBRARIES ${RDKAFKA_CPP_LIBRARY} ${RDKAFKA_C_LIBRARY})
    endif()
endif()

if(NOT RDKAFKA_CPP_FOUND)
    message(FATAL_ERROR "librdkafka C++ bindings not found.")
endif()

# 2. Add Executable Target
add_executable(risk_engine
    src/main.cpp
    src/risk_engine.cpp
)

# 3. Target Include Directories (explicitly including Ubuntu path suffix)
target_include_directories(risk_engine PRIVATE
    include
    ${RDKAFKA_CPP_INCLUDE_DIRS}
    /usr/include/librdkafka
)

# 4. Link Target Libraries
target_link_libraries(risk_engine PRIVATE
    ${RDKAFKA_CPP_LIBRARIES}
)

# 5. Compiler Options
target_compile_options(risk_engine PRIVATE
    -Wall
    -Wextra
    -Wpedantic
    -Wconversion
)

# 6. AddressSanitizer Flags
if(RISK_ENGINE_ENABLE_ASAN)
    target_compile_options(risk_engine PRIVATE -fsanitize=address -fno-omit-frame-pointer)
    target_link_options(risk_engine PRIVATE -fsanitize=address)
endif()