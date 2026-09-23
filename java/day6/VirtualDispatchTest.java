package day6;

// 书第7章用例：构造器链（invokespecial <init>）+ invokevirtual 动态分派
class Animal {
    int legs = 4;

    Animal() {
    }

    int speak() {
        return 1;
    }
}

class Dog extends Animal {
    Dog() {
        super();
    }

    int speak() {
        return 2;
    }
}

public class VirtualDispatchTest {
    static int RESULT;

    public static void main(String[] args) {
        Animal a = new Dog();
        // 动态分派应命中 Dog.speak()，再加上继承来的实例字段 legs
        RESULT = a.speak() * 100 + a.legs; // 期望 204
    }
}
